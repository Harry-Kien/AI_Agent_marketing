/**
 * Điều phối vòng đời chiến dịch KHÔNG phụ thuộc Telegram — dùng chung đúng policy engine
 * mà telegram-bot dùng, để dashboard (qua Control API) và Telegram cùng điều khiển một
 * state machine. Giữ thuần hàm, bất định thời gian qua now() để test được.
 */
import { generateMarketingAgentOutput, type AiProviderConfig } from "./aiProvider";
import {
  approveRunAndPreparePublication,
  completePublication,
  completeRun,
  confirmPublication,
  createCampaign,
  rejectRun,
  requestPublicationConfirmation,
  reviseRun,
  type MarketingAgentRunRuntime,
  type MarketingWorkflowState
} from "./marketingWorkflow";
import { evaluateApprovalPolicy, type ApprovalPolicyConfig } from "./approvalPolicy";
import { applyApprovalPolicyDecision } from "./workflowApproval";

// Ánh xạ stage -> lệnh gửi cho agent, khớp đúng telegram-bot.
const stageCommands: Record<MarketingAgentRunRuntime["stage"], string> = {
  research: "trend",
  content: "post",
  creative: "creative",
  brand: "review",
  final: "finalize"
};

export interface OrchestratorContext {
  ai: AiProviderConfig;
  policy: ApprovalPolicyConfig;
  now?: () => string;
}

// Tìm run đang chờ người duyệt (active). Ưu tiên activeRunId của chiến dịch mới nhất.
export function findActivePendingRun(state: MarketingWorkflowState): MarketingAgentRunRuntime | undefined {
  const campaign = state.campaigns[state.campaigns.length - 1];
  if (campaign?.activeRunId) {
    const active = state.runs.find((run) => run.id === campaign.activeRunId && run.status === "pending_approval");
    if (active) return active;
  }
  return [...state.runs].reverse().find((run) => run.status === "pending_approval");
}

// Chạy một run đang "running": sinh output agent, hoàn tất run, áp policy và tự bàn giao nội bộ
// cho tới khi gặp cổng cần người duyệt (human_approval) hoặc escalate hoặc hết run.
async function advanceFromRunningStage(
  state: MarketingWorkflowState,
  startRunId: string,
  ctx: OrchestratorContext
): Promise<MarketingWorkflowState> {
  const now = ctx.now ?? (() => new Date().toISOString());
  let current = state;
  let nextRunId: string | undefined = startRunId;

  while (nextRunId) {
    const run: MarketingAgentRunRuntime | undefined = current.runs.find(
      (item) => item.id === nextRunId && item.status === "running"
    );
    if (!run) break;
    const campaign = current.campaigns.find((item) => item.id === run.campaignId);
    if (!campaign) break;

    const output = await generateMarketingAgentOutput(ctx.ai, {
      role: run.role,
      command: stageCommands[run.stage],
      topic: campaign.brief,
      context: run.input
    });

    const completed = completeRun(current, run.id, output.text, now, {
      fallbackReason: output.fallbackReason,
      publicationContent: run.stage === "final" ? output.product.publication_content : undefined
    });
    current = completed.state;

    const revisionCount = Math.max(
      0,
      current.runs.filter(
        (item) => item.campaignId === completed.run.campaignId && item.stage === completed.run.stage
      ).length - 1
    );
    const decision = evaluateApprovalPolicy({
      config: ctx.policy,
      stage: completed.run.stage,
      product: output.product,
      outputMode: output.mode,
      fallbackReason: output.fallbackReason,
      revisionCount
    });

    if (decision.action === "human_approval") break;
    const applied = applyApprovalPolicyDecision(current, completed.run.id, decision, now);
    current = applied.state;
    if (decision.action === "escalate" || !applied.nextRun) break;
    nextRunId = applied.nextRun.id;
  }
  return current;
}

// Mở chiến dịch mới và chạy tới cổng người duyệt đầu tiên.
export async function startCampaign(
  state: MarketingWorkflowState,
  ctx: OrchestratorContext,
  input: { brief: string; createdBy: string; idSuffix?: string }
): Promise<MarketingWorkflowState> {
  const created = createCampaign(state, {
    brief: input.brief,
    createdBy: input.createdBy,
    idSuffix: input.idSuffix ?? `D${Date.now()}`
  });
  return advanceFromRunningStage(created.state, created.run.id, ctx);
}

// Duyệt run đang chờ. Nếu là Final thì chuẩn bị bản xem trước xuất bản; nếu không thì
// tự bàn giao và chạy tiếp tới cổng người duyệt kế.
export async function approveActive(
  state: MarketingWorkflowState,
  ctx: OrchestratorContext,
  actorId: string
): Promise<MarketingWorkflowState> {
  const now = ctx.now ?? (() => new Date().toISOString());
  const pending = findActivePendingRun(state);
  if (!pending) return state;
  const result = approveRunAndPreparePublication(state, pending.id, actorId, now);
  if (result.publicationPrepared || result.alreadyApplied || !result.nextRun) return result.state;
  return advanceFromRunningStage(result.state, result.nextRun.id, ctx);
}

// Từ chối run đang chờ kèm lý do, tạo bản sửa và chạy lại stage đó.
export async function rejectActive(
  state: MarketingWorkflowState,
  ctx: OrchestratorContext,
  input: { feedback: string; actorId: string }
): Promise<MarketingWorkflowState> {
  const now = ctx.now ?? (() => new Date().toISOString());
  const feedback = input.feedback.trim() || "Cần chỉnh sửa theo yêu cầu người vận hành.";
  const pending = findActivePendingRun(state);
  if (!pending) return state;
  const rejected = rejectRun(state, pending.id, feedback, input.actorId, now);
  const revision = reviseRun(rejected.state, pending.id, feedback, input.actorId, now);
  return advanceFromRunningStage(revision.state, revision.run.id, ctx);
}

// Yêu cầu xác nhận xuất bản (tạo bản xem trước) cho chiến dịch mới nhất ở trạng thái ready_to_schedule.
export function requestPublication(
  state: MarketingWorkflowState,
  actorId: string,
  now: () => string = () => new Date().toISOString()
): MarketingWorkflowState {
  const campaign = state.campaigns[state.campaigns.length - 1];
  if (!campaign || campaign.stage !== "ready_to_schedule") return state;
  return requestPublicationConfirmation(state, campaign.id, actorId, now).state;
}

// Xác nhận xuất bản. Meta guarded: nếu chưa bật publish thật thì hoàn tất bằng bằng chứng mock
// rõ ràng (không gọi Meta) để demo khép kín; khi bật thật, publisher truyền vào sẽ được dùng.
export async function confirmPublicationFlow(
  state: MarketingWorkflowState,
  input: {
    actorId: string;
    publisher?: (message: string) => Promise<{ postId: string; permalink?: string; publishedAt?: string }>;
    now?: () => string;
  }
): Promise<MarketingWorkflowState> {
  const now = input.now ?? (() => new Date().toISOString());
  const campaign = state.campaigns[state.campaigns.length - 1];
  if (!campaign || campaign.stage !== "publication_pending_confirmation") return state;
  const confirmed = confirmPublication(state, campaign.id, input.actorId, now);
  const message =
    confirmed.campaign.publicationPreview?.replace(/^Bản xem trước xuất bản:\s*/, "") ?? confirmed.campaign.brief;
  const evidence = input.publisher ? await input.publisher(message) : { postId: `MOCK-${campaign.id}` };
  return completePublication(confirmed.state, campaign.id, {
    postId: evidence.postId,
    permalink: evidence.permalink
  }).state;
}

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
import { resolveModelRouting } from "./modelRouter";
import { formatKnowledgeForPrompt, retrieveKnowledge, retrieveKnowledgeSmart } from "./knowledgeBase";
import type { BrandKnowledgeBase } from "../domain/knowledgeTypes";
import type { EmbeddingConfig } from "./embeddingProvider";
import { evaluateAgentOutput } from "./agentEval";
import { estimateCostUsd, estimateTokens, type AgentSpan } from "./telemetry";
import { formatMemoriesForPrompt, retrieveMemories } from "./campaignMemory";
import type { CampaignMemory } from "../domain/memoryTypes";

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
  knowledge?: BrandKnowledgeBase;
  knowledgeEmbeddings?: Array<number[] | undefined>;
  embedConfig?: EmbeddingConfig;
  memories?: CampaignMemory[];
  onSpan?: (span: AgentSpan) => void;
  env?: Record<string, string | undefined>;
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

    const routing = resolveModelRouting(run.role, ctx.env ?? {});
    // RAG: nạp căn cứ thương hiệu liên quan để agent bám dữ liệu thật thay vì bịa.
    let context = run.input;
    if (ctx.knowledge) {
      const query = `${campaign.brief} ${run.stage}`;
      const hits = ctx.embedConfig
        ? await retrieveKnowledgeSmart(ctx.knowledge, query, {
            config: ctx.embedConfig,
            embeddings: ctx.knowledgeEmbeddings,
            k: 3
          })
        : retrieveKnowledge(ctx.knowledge, query, 3);
      const grounding = formatKnowledgeForPrompt(hits);
      if (grounding) context = `${grounding}\n\n${context}`;
    }
    // Memory: giai đoạn nghiên cứu học từ chiến dịch trước (chuẩn "memory" 2026).
    if (run.stage === "research" && ctx.memories?.length) {
      const memoryHits = retrieveMemories(ctx.memories, campaign.brief, 2);
      const recall = formatMemoriesForPrompt(memoryHits);
      if (recall) context = `${recall}\n\n${context}`;
    }
    const startAt = now();
    const output = await generateMarketingAgentOutput(ctx.ai, {
      role: run.role,
      command: stageCommands[run.stage],
      topic: campaign.brief,
      context,
      modelOverride: routing.model
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

    // Eval độc lập: không tin điểm agent tự khai. Cap điểm hiệu dụng và chặn nếu vi phạm an toàn.
    const evaluation = await evaluateAgentOutput(output.product, { topic: campaign.brief, ai: ctx.ai });
    const effectiveProduct = {
      ...output.product,
      quality_score: Math.min(output.product.quality_score, evaluation.score)
    };

    if (ctx.onSpan) {
      const endAt = now();
      const tokensIn = estimateTokens(`${campaign.brief} ${context}`);
      const tokensOut = estimateTokens(output.text);
      ctx.onSpan({
        runId: completed.run.id,
        campaignId: campaign.id,
        role: run.role,
        stage: run.stage,
        model: output.model,
        tier: routing.tier,
        mode: output.mode,
        tokensIn,
        tokensOut,
        costUsd: estimateCostUsd(routing.tier, tokensIn, tokensOut),
        evalScore: evaluation.score,
        verdict: evaluation.verdict,
        durationMs: Math.max(0, Date.parse(endAt) - Date.parse(startAt)),
        at: endAt
      });
    }
    const decision =
      evaluation.verdict === "block"
        ? { action: "escalate" as const, reason: `Eval độc lập chặn: ${evaluation.issues[0] ?? "vi phạm an toàn thương hiệu"}` }
        : evaluateApprovalPolicy({
            config: ctx.policy,
            stage: completed.run.stage,
            product: effectiveProduct,
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

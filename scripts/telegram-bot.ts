import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { seedData } from "../src/data/seed";
import {
  createAiProviderConfig,
  generateMarketingAgentOutput,
  type MarketingAgentOutput
} from "../src/integrations/aiProvider";
import {
  approveRun,
  completePublication,
  completeRun,
  confirmPublication,
  createCampaign,
  createEmptyWorkflowState,
  getCampaignTimeline,
  listPendingRuns,
  rejectRun,
  requestPublicationConfirmation,
  reviseRun,
  type MarketingAgentRunRuntime,
  type MarketingCampaignRuntime
} from "../src/integrations/marketingWorkflow";
import {
  createTelegramSession,
  getMarketingBotConfigsFromEnv,
  handleMarketingTeamCommand,
  handleTelegramCommand,
  type MarketingBotConfig,
  type MarketingBotRole
} from "../src/integrations/telegramAdapter";
import {
  buildRuntimeHealthFromConfig,
  cleanTelegramText,
  evaluateTelegramAuthorization
} from "../src/integrations/telegramRuntime";
import {
  addProcessedUpdate,
  createRuntimeSnapshot,
  hasProcessedUpdate,
  loadRuntimeSnapshot,
  saveRuntimeSnapshot,
  setBotOffset,
  type TelegramRuntimeSnapshot
} from "../src/integrations/telegramStateStore";
import { intentToFallbackCommand, resolveManagerIntent } from "../src/integrations/managerIntent";
import { createMetaGraphClient, createMetaGraphConfig } from "../src/integrations/metaGraphAdapter";

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    text?: string;
    chat: { id: number | string; type: string };
    from?: { id: number | string; username?: string };
  };
}

interface RuntimeController {
  snapshot: TelegramRuntimeSnapshot;
  statePath: string;
  mutationQueue: Promise<void>;
}

const specialistCommands = new Set([
  "trend", "competitor", "audience", "insight", "angle",
  "post", "caption", "script", "calendar", "hook",
  "creative", "visual", "storyboard", "asset", "variant",
  "review", "brandcheck", "cta", "measure",
  "community", "inbox", "schedule", "publish", "metrics"
]);

const managerCommands = new Set([
  "start", "help", "brief", "flow", "campaign", "campaigns", "status",
  "approvals", "audit", "approve", "reject", "revise", "tasks", "run",
  "schedule", "confirm", "community", "health", "report", "whoami"
]);

const roleCommands: Record<MarketingBotRole, Set<string>> = {
  manager: managerCommands,
  "market-radar": new Set(["start", "help", "trend", "competitor", "audience", "insight", "angle", "whoami"]),
  "content-creator": new Set(["start", "help", "post", "caption", "script", "calendar", "hook", "whoami"]),
  "creative-production": new Set(["start", "help", "creative", "visual", "storyboard", "asset", "variant", "whoami"]),
  "performance-brand": new Set(["start", "help", "review", "brandcheck", "cta", "measure", "report", "whoami"]),
  "page-growth": new Set(["start", "help", "community", "inbox", "schedule", "publish", "metrics", "whoami"])
};

const workflowCommands = new Set([
  "campaign", "campaigns", "status", "approvals", "audit", "approve", "reject", "revise", "schedule", "confirm", "community", "report"
]);

const stageCommands: Record<MarketingAgentRunRuntime["stage"], string> = {
  research: "trend",
  content: "post",
  creative: "creative",
  brand: "review",
  final: "finalize"
};

const roleUpdatePrefixes: Record<MarketingBotRole, number> = {
  manager: 1,
  "market-radar": 2,
  "content-creator": 3,
  "creative-production": 4,
  "performance-brand": 5,
  "page-growth": 6
};

function loadDotEnv() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...valueParts] = trimmed.split("=");
    if (!process.env[key]) process.env[key] = valueParts.join("=").replace(/^["']|["']$/g, "");
  }
}

function parseCommand(text: string) {
  const raw = text.trim();
  if (!raw.startsWith("/")) return { command: "natural", args: [raw] };
  const [head = "", ...args] = raw.split(/\s+/).filter(Boolean);
  return { command: head.replace(/^\//, "").split("@")[0].toLowerCase(), args };
}

function shouldBotHandleMessage(role: MarketingBotRole, command: string) {
  if (command === "natural") return role === "manager";
  return roleCommands[role].has(command);
}

function getBotConfigs(): MarketingBotConfig[] {
  try {
    return getMarketingBotConfigsFromEnv(process.env);
  } catch (error) {
    const fallbackToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!fallbackToken) throw error;
    return [{
      role: "manager",
      token: fallbackToken,
      displayName: "Marketing Manager Bot",
      commands: [...managerCommands],
      shortDescription: "AI marketing manager for controlled campaign operations.",
      description: "Marketing command center with human approval gates."
    }];
  }
}

async function telegramApi<T>(token: string, method: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: AbortSignal.timeout(method === "getUpdates" ? 35_000 : 15_000),
    body: JSON.stringify(body)
  });
  const payload = (await response.json()) as { ok: boolean; result?: T; description?: string };
  if (!payload.ok) throw new Error(payload.description ?? `Telegram API error while calling ${method}`);
  return payload.result as T;
}

async function sendMessage(token: string, chatId: number | string, text: string) {
  await telegramApi(token, "sendMessage", {
    chat_id: chatId,
    text: cleanTelegramText(text).slice(0, 3900),
    disable_web_page_preview: true
  });
}

async function sendTyping(token: string, chatId: number | string) {
  await telegramApi(token, "sendChatAction", { chat_id: chatId, action: "typing" });
}

function wait(ms: number) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

async function mutateRuntime<T>(
  controller: RuntimeController,
  mutation: (snapshot: TelegramRuntimeSnapshot) => { snapshot: TelegramRuntimeSnapshot; value: T }
): Promise<T> {
  let resolveValue: (value: T) => void;
  let rejectValue: (reason: unknown) => void;
  const result = new Promise<T>((resolvePromise, rejectPromise) => {
    resolveValue = resolvePromise;
    rejectValue = rejectPromise;
  });
  controller.mutationQueue = controller.mutationQueue.then(async () => {
    try {
      const changed = mutation(controller.snapshot);
      await saveRuntimeSnapshot(controller.statePath, changed.snapshot);
      controller.snapshot = changed.snapshot;
      resolveValue(changed.value);
    } catch (error) {
      rejectValue(error);
    }
  });
  return result;
}

function updateKey(role: MarketingBotRole, updateId: number) {
  return roleUpdatePrefixes[role] * 1_000_000_000_000 + updateId;
}

async function markUpdateProcessed(
  controller: RuntimeController,
  role: MarketingBotRole,
  updateId: number
) {
  await mutateRuntime(controller, (snapshot) => {
    let next = addProcessedUpdate(snapshot, updateKey(role, updateId));
    next = setBotOffset(next, role, updateId + 1);
    return { snapshot: next, value: undefined };
  });
}

function roleLabel(role: MarketingBotRole) {
  return ({
    manager: "Marketing Manager",
    "market-radar": "Market Radar",
    "content-creator": "Content Strategy & Copy",
    "creative-production": "Creative Production",
    "performance-brand": "Brand & Performance",
    "page-growth": "Page Growth & Community"
  })[role];
}

function stageLabel(stage: MarketingAgentRunRuntime["stage"]) {
  return ({ research: "Research", content: "Content Strategy", creative: "Creative Production", brand: "Brand & KPI", final: "Final Package" })[stage];
}

function formatRunResult(run: MarketingAgentRunRuntime, output: MarketingAgentOutput) {
  return [
    `${roleLabel(run.role)} - ${stageLabel(run.stage)} Package`,
    `Campaign: ${run.campaignId}`,
    `Run: ${run.id}`,
    "",
    output.text,
    "",
    "CỔNG PHÊ DUYỆT CỦA CON NGƯỜI",
    `Duyệt: /approve ${run.id}`,
    `Từ chối: /reject ${run.id} <lý do cụ thể>`,
    `Nguồn xử lý: ${output.mode === "ai" ? "9Router AI" : "mô phỏng local an toàn"}`,
    output.fallbackReason ? `Ghi chú vận hành: ${output.fallbackReason}` : ""
  ].filter(Boolean).join("\n");
}

function formatCampaignStatus(campaign: MarketingCampaignRuntime, runs: MarketingAgentRunRuntime[]) {
  const campaignRuns = runs.filter((run) => run.campaignId === campaign.id);
  return [
    `CHIẾN DỊCH ${campaign.id}`,
    `Mục tiêu: ${campaign.brief}`,
    `Trạng thái: ${campaign.stage}`,
    `Đã duyệt: ${campaign.approvedRunIds.length}/5 cổng`,
    `Run hiện tại: ${campaign.activeRunId ?? "không có"}`,
    "",
    ...campaignRuns.map((run) => `- ${run.id} | ${stageLabel(run.stage)} | ${run.status}`),
    campaign.stage === "ready_to_schedule"
      ? "Kết luận: sẵn sàng triển khai thủ công; hệ thống chưa tự đăng hoặc chạy quảng cáo."
      : "Bước tiếp theo: xem /approvals hoặc chờ bot chuyên môn hoàn thành."
  ].join("\n");
}

function formatCampaigns(snapshot: TelegramRuntimeSnapshot) {
  if (snapshot.workflow.campaigns.length === 0) return "Chưa có chiến dịch. Dùng /campaign <mục tiêu>.";
  return [
    "DANH SÁCH CHIẾN DỊCH",
    ...snapshot.workflow.campaigns.slice(-10).reverse().map((campaign) =>
      `- ${campaign.id} | ${campaign.stage} | ${campaign.approvedRunIds.length}/5 cổng | ${campaign.brief.slice(0, 70)}`
    ),
    "Chi tiết: /status <CAMPAIGN_ID>"
  ].join("\n");
}

function formatApprovals(snapshot: TelegramRuntimeSnapshot) {
  const pending = listPendingRuns(snapshot.workflow);
  if (pending.length === 0) return "Không có kết quả nào đang chờ duyệt.";
  return [
    "HÀNG ĐỢI PHÊ DUYỆT",
    ...pending.map((run) => `- ${run.id} | ${run.campaignId} | ${stageLabel(run.stage)} | ${roleLabel(run.role)}`),
    "Dùng /approve <RUN_ID> hoặc /reject <RUN_ID> <lý do>."
  ].join("\n");
}

function formatWhoami(update: TelegramUpdate) {
  return [
    "THÔNG TIN KHÓA QUYỀN TELEGRAM",
    `TELEGRAM_GROUP_ID=${update.message?.chat.id ?? ""}`,
    `OPERATOR_TELEGRAM_USER_ID=${update.message?.from?.id ?? ""}`,
    `Chat type: ${update.message?.chat.type ?? "unknown"}`,
    `Username: ${update.message?.from?.username ? `@${update.message.from.username}` : "unknown"}`
  ].join("\n");
}

async function runWorkflowStage(
  runId: string,
  chatId: number | string,
  configs: MarketingBotConfig[],
  controller: RuntimeController
) {
  const run = controller.snapshot.workflow.runs.find((item) => item.id === runId);
  if (!run || run.status !== "running") return;
  const campaign = controller.snapshot.workflow.campaigns.find((item) => item.id === run.campaignId);
  if (!campaign) throw new Error(`Campaign ${run.campaignId} does not exist.`);
  let target = configs.find((item) => item.role === run.role);
  if (!target) {
    const manager = configs.find((item) => item.role === "manager");
    if (!manager) throw new Error(`Bot for role ${run.role} is unavailable.`);
    target = manager;
    await sendMessage(manager.token, chatId, `Kênh ${roleLabel(run.role)} chưa xác thực. Manager chuyển tiếp nhiệm vụ có ghi vết để workflow không bị gián đoạn.`);
  }

  try {
    await sendTyping(target.token, chatId);
  } catch {
    const manager = configs.find((item) => item.role === "manager");
    if (!manager) throw new Error(`Bot for role ${run.role} is unavailable.`);
    target = manager;
    await sendMessage(manager.token, chatId, `Kênh ${roleLabel(run.role)} đang lỗi xác thực. Manager chuyển tiếp nhiệm vụ có ghi vết để workflow không bị gián đoạn.`);
  }
  await sendMessage(target.token, chatId, [
    `${roleLabel(run.role)} đã nhận nhiệm vụ ${stageLabel(run.stage)}.`,
    `Campaign: ${campaign.id}`,
    `Run: ${run.id}`,
    "Đang xử lý đầu vào đã được duyệt từ cổng trước."
  ].join("\n"));
  await sendTyping(target.token, chatId);
  await wait(700);

  const output = await generateMarketingAgentOutput(createAiProviderConfig(process.env), {
    role: run.role,
    command: stageCommands[run.stage],
    topic: campaign.brief,
    context: run.input
  });

  const completedRun = await mutateRuntime(controller, (snapshot) => {
    const completed = completeRun(
      snapshot.workflow,
      run.id,
      output.text,
      () => new Date().toISOString(),
      { fallbackReason: output.fallbackReason }
    );
    return {
      snapshot: { ...snapshot, workflow: completed.state },
      value: completed.run
    };
  });
  await sendTyping(target.token, chatId);
  await sendMessage(target.token, chatId, formatRunResult(completedRun, output));
}

async function handleWorkflowCommand(
  parsed: ReturnType<typeof parseCommand>,
  update: TelegramUpdate,
  configs: MarketingBotConfig[],
  controller: RuntimeController
) {
  const manager = configs.find((item) => item.role === "manager");
  if (!manager || !update.message) return;
  const chatId = update.message.chat.id;
  const actorId = String(update.message.from?.id ?? "unknown");

  if (parsed.command === "campaign") {
    const brief = parsed.args.join(" ").trim();
    if (!brief) {
      await sendMessage(manager.token, chatId, "Cách dùng: /campaign <mục tiêu chiến dịch cụ thể>.");
      return;
    }
    const created = await mutateRuntime(controller, (snapshot) => {
      const result = createCampaign(snapshot.workflow, {
        brief,
        createdBy: actorId,
        idSuffix: `M${update.update_id}`
      });
      return { snapshot: { ...snapshot, workflow: result.state }, value: result };
    });
    await sendMessage(manager.token, chatId, [
      `Đã mở chiến dịch ${created.campaign.id}.`,
      "Quy trình Stage-Gate: Research → duyệt → Content Strategy → duyệt → Creative → duyệt → Brand & KPI → duyệt → Final → duyệt.",
      `Market Radar đang nhận run ${created.run.id}.`
    ].join("\n"));
    await runWorkflowStage(created.run.id, chatId, configs, controller);
    return;
  }

  if (parsed.command === "campaigns") {
    await sendMessage(manager.token, chatId, formatCampaigns(controller.snapshot));
    return;
  }

  if (parsed.command === "approvals") {
    await sendMessage(manager.token, chatId, formatApprovals(controller.snapshot));
    return;
  }

  if (parsed.command === "community") {
    await sendMessage(manager.token, chatId, "Hàng chờ cộng đồng hiện chưa có tương tác mới. Auto-reply đang tắt; giá, khiếu nại và dữ liệu cá nhân luôn chuyển cho người quản lý.");
    return;
  }

  if (parsed.command === "schedule") {
    const campaigns = controller.snapshot.workflow.campaigns;
    const requestedId = parsed.args[0];
    const campaign = requestedId ? campaigns.find((item) => item.id === requestedId) : campaigns[campaigns.length - 1];
    if (!campaign) { await sendMessage(manager.token, chatId, "Không tìm thấy chiến dịch để chuẩn bị đăng."); return; }
    const preview = await mutateRuntime(controller, (snapshot) => {
      const result = requestPublicationConfirmation(snapshot.workflow, campaign.id, actorId);
      return { snapshot: { ...snapshot, workflow: result.state }, value: result.campaign };
    });
    const growth = configs.find((item) => item.role === "page-growth") ?? manager;
    await sendMessage(growth.token, chatId, [
      `PAGE GROWTH - BẢN XEM TRƯỚC ${preview.id}`,
      preview.publicationPreview ?? preview.brief,
      "Trạng thái: chờ xác nhận xuất bản lần cuối.",
      `Bạn có thể nhắn: Xác nhận đăng ${preview.id}`
    ].join("\n"));
    return;
  }

  if (parsed.command === "confirm") {
    const campaigns = controller.snapshot.workflow.campaigns;
    const requestedId = parsed.args[0];
    const campaign = requestedId ? campaigns.find((item) => item.id === requestedId) : campaigns[campaigns.length - 1];
    if (!campaign) { await sendMessage(manager.token, chatId, "Không tìm thấy chiến dịch cần xác nhận."); return; }
    const metaConfig = createMetaGraphConfig(process.env);
    if (!metaConfig.publishEnabled) {
      await sendMessage(manager.token, chatId, "Đã ghi nhận ý định xác nhận, nhưng Meta publish đang khóa an toàn. Hãy thay token đã lộ và bật META_PUBLISH_ENABLED=true sau khi kiểm tra quyền App.");
      return;
    }
    const confirmed = await mutateRuntime(controller, (snapshot) => {
      const result = confirmPublication(snapshot.workflow, campaign.id, actorId);
      return { snapshot: { ...snapshot, workflow: result.state }, value: result.campaign };
    });
    const message = confirmed.publicationPreview?.replace(/^Bản xem trước xuất bản:\s*/, "") ?? confirmed.brief;
    const evidence = await createMetaGraphClient(metaConfig).publish({ message, confirmationText: message, approvalId: `${confirmed.id}:${actorId}` });
    await mutateRuntime(controller, (snapshot) => {
      const result = completePublication(snapshot.workflow, confirmed.id, evidence);
      return { snapshot: { ...snapshot, workflow: result.state }, value: result.campaign };
    });
    await sendMessage(manager.token, chatId, `Đã xuất bản có bằng chứng: ${evidence.postId}`);
    return;
  }

  if (parsed.command === "status" || parsed.command === "report") {
    const requestedId = parsed.args[0];
    const campaigns = controller.snapshot.workflow.campaigns;
    const campaign = requestedId
      ? campaigns.find((item) => item.id === requestedId)
      : campaigns[campaigns.length - 1];
    await sendMessage(
      manager.token,
      chatId,
      campaign
        ? formatCampaignStatus(campaign, controller.snapshot.workflow.runs)
        : "Không tìm thấy chiến dịch. Dùng /campaigns để xem ID hợp lệ."
    );
    return;
  }

  if (parsed.command === "audit") {
    const campaignId = parsed.args[0];
    if (!campaignId) {
      await sendMessage(manager.token, chatId, "Cách dùng: /audit <CAMPAIGN_ID>.");
      return;
    }
    try {
      const events = getCampaignTimeline(controller.snapshot.workflow, campaignId);
      await sendMessage(manager.token, chatId, [
        `NHẬT KÝ ${campaignId}`,
        ...events.slice(-20).map((event) => `- ${event.createdAt} | ${event.action} | ${event.actorId} | ${event.summary}`)
      ].join("\n"));
    } catch {
      await sendMessage(manager.token, chatId, "Không tìm thấy chiến dịch. Dùng /campaigns để xem ID hợp lệ.");
    }
    return;
  }

  if (parsed.command === "approve") {
    const runId = parsed.args[0];
    if (!runId) {
      await sendMessage(manager.token, chatId, "Cách dùng: /approve <RUN_ID>.");
      return;
    }
    const approved = await mutateRuntime(controller, (snapshot) => {
      const result = approveRun(snapshot.workflow, runId, actorId);
      return { snapshot: { ...snapshot, workflow: result.state }, value: result };
    });
    if (approved.alreadyApplied) {
      await sendMessage(manager.token, chatId, `${runId} đã được duyệt trước đó; không tạo nhiệm vụ trùng.`);
      return;
    }
    if (!approved.nextRun) {
      await sendMessage(manager.token, chatId, [
        `Đã duyệt cổng cuối cho ${approved.campaign.id}.`,
        "Trạng thái: ready_to_schedule.",
        "Hệ thống không tự đăng bài, chạy ads hoặc chi tiền."
      ].join("\n"));
      return;
    }
    await sendMessage(manager.token, chatId, [
      `Đã duyệt ${runId}.`,
      `Chuyển giao có kiểm soát sang ${roleLabel(approved.nextRun.role)}.`,
      `Run tiếp theo: ${approved.nextRun.id}`
    ].join("\n"));
    await runWorkflowStage(approved.nextRun.id, chatId, configs, controller);
    return;
  }

  if (parsed.command === "reject") {
    const [runId, ...reasonParts] = parsed.args;
    const reason = reasonParts.join(" ").trim();
    if (!runId || !reason) {
      await sendMessage(manager.token, chatId, "Cách dùng: /reject <RUN_ID> <lý do cụ thể>.");
      return;
    }
    const rejected = await mutateRuntime(controller, (snapshot) => {
      const result = rejectRun(snapshot.workflow, runId, reason, actorId);
      return { snapshot: { ...snapshot, workflow: result.state }, value: result };
    });
    await sendMessage(manager.token, chatId, [
      `Đã từ chối ${rejected.run.id}.`,
      `Lý do: ${reason}`,
      `Yêu cầu sửa: /revise ${rejected.run.id} <chỉ dẫn sửa cụ thể>`
    ].join("\n"));
    return;
  }

  if (parsed.command === "revise") {
    const [runId, ...feedbackParts] = parsed.args;
    const feedback = feedbackParts.join(" ").trim();
    if (!runId || !feedback) {
      await sendMessage(manager.token, chatId, "Cách dùng: /revise <RUN_ID> <yêu cầu sửa cụ thể>.");
      return;
    }
    const revision = await mutateRuntime(controller, (snapshot) => {
      const result = reviseRun(snapshot.workflow, runId, feedback, actorId);
      return { snapshot: { ...snapshot, workflow: result.state }, value: result };
    });
    await sendMessage(manager.token, chatId, `Đã mở revision ${revision.run.id} từ ${runId}.`);
    await runWorkflowStage(revision.run.id, chatId, configs, controller);
  }
}

async function handleLegacyCommand(
  config: MarketingBotConfig,
  parsed: ReturnType<typeof parseCommand>,
  routedText: string,
  chatId: number | string,
  controller: RuntimeController
) {
  const result = await mutateRuntime(controller, (snapshot) => {
    const handled = process.env.TELEGRAM_MARKET_RADAR_BOT_TOKEN
      ? handleMarketingTeamCommand(snapshot.telegramSession, routedText, config.role)
      : handleTelegramCommand(snapshot.telegramSession, routedText);
    return {
      snapshot: { ...snapshot, telegramSession: handled.session },
      value: handled
    };
  });

  if (config.role !== "manager" && specialistCommands.has(parsed.command)) {
    await sendTyping(config.token, chatId);
    const output = await generateMarketingAgentOutput(createAiProviderConfig(process.env), {
      role: config.role,
      command: parsed.command,
      topic: parsed.args.join(" ").trim() || "AI Agent cho SME",
      context: "Yêu cầu trực tiếp ngoài workflow chiến dịch; kết quả chưa được đưa vào Stage-Gate."
    });
    await sendMessage(config.token, chatId, [
      `${config.displayName} - tư vấn chuyên môn độc lập`,
      output.text,
      "Kết quả này chưa thuộc chiến dịch. Dùng Manager /campaign <mục tiêu> để chạy quy trình doanh nghiệp."
    ].join("\n\n"));
    return;
  }
  for (const reply of result.messages) await sendMessage(config.token, chatId, reply);
}

async function processUpdate(
  config: MarketingBotConfig,
  allConfigs: MarketingBotConfig[],
  update: TelegramUpdate,
  controller: RuntimeController
) {
  const message = update.message;
  if (!message?.text) return;
  const parsed = parseCommand(message.text);
  console.log(JSON.stringify({
    event: "telegram_message",
    bot: config.role,
    chat_id: message.chat.id,
    from_id: message.from?.id,
    command: parsed.command
  }));
  if (!shouldBotHandleMessage(config.role, parsed.command)) return;

  const authorization = evaluateTelegramAuthorization(process.env, {
    chatId: String(message.chat.id),
    userId: String(message.from?.id ?? "")
  });
  if (parsed.command === "whoami") {
    const configured = Boolean(process.env.TELEGRAM_GROUP_ID && process.env.OPERATOR_TELEGRAM_USER_ID);
    if (!configured || authorization.allowed) await sendMessage(config.token, message.chat.id, formatWhoami(update));
    return;
  }
  if (!authorization.allowed) {
    await sendMessage(
      config.token,
      message.chat.id,
      authorization.reason === "missing_configuration"
        ? "Command Center chưa khóa quyền. Dùng /whoami rồi cấu hình Group ID và Operator ID."
        : "Command Center chỉ nhận lệnh từ group và người quản lý đã cấu hình."
    );
    return;
  }

  let routedText = message.text;
  if (config.role === "manager" && parsed.command === "natural") {
    const pendingRunIds = listPendingRuns(controller.snapshot.workflow).map((run) => run.id);
    const rejectedRunIds = controller.snapshot.workflow.runs
      .filter((run) => run.status === "rejected")
      .map((run) => run.id);
    const decision = await resolveManagerIntent(message.text, {
      pendingRunIds,
      rejectedRunIds,
      campaignIds: controller.snapshot.workflow.campaigns.map((campaign) => campaign.id)
    });
    const fallbackCommand = intentToFallbackCommand(decision);
    if (!fallbackCommand || decision.confidence < 0.82) {
      await sendMessage(config.token, message.chat.id, decision.clarification ?? "Bạn vui lòng nói rõ yêu cầu.");
      return;
    }
    routedText = fallbackCommand;
  }
  const routedParsed = parseCommand(routedText);
  if (config.role === "manager" && routedParsed.command === "health") {
    await sendMessage(
      config.token,
      message.chat.id,
      buildRuntimeHealthFromConfig(allConfigs, createAiProviderConfig(process.env), process.env)
    );
    return;
  }
  if (config.role === "manager" && workflowCommands.has(routedParsed.command)) {
    await handleWorkflowCommand(routedParsed, update, allConfigs, controller);
    return;
  }
  await handleLegacyCommand(config, routedParsed, routedText, message.chat.id, controller);
}

async function pollBot(
  config: MarketingBotConfig,
  allConfigs: MarketingBotConfig[],
  controller: RuntimeController
) {
  let offset = controller.snapshot.botOffsets[config.role] ?? 0;
  let retryDelayMs = 1_000;
  console.log(`${config.displayName} is running from offset ${offset}.`);
  while (true) {
    try {
      const updates = await telegramApi<TelegramUpdate[]>(config.token, "getUpdates", {
        offset,
        timeout: 25,
        allowed_updates: ["message"]
      });
      retryDelayMs = 1_000;
      for (const update of updates) {
        offset = update.update_id + 1;
        const key = updateKey(config.role, update.update_id);
        if (hasProcessedUpdate(controller.snapshot, key)) continue;
        try {
          await processUpdate(config, allConfigs, update, controller);
          await markUpdateProcessed(controller, config.role, update.update_id);
        } catch (error) {
          const errorId = `TG-${Date.now()}`;
          console.error(JSON.stringify({
            event: "telegram_command_error",
            error_id: errorId,
            bot: config.role,
            detail: error instanceof Error ? error.message : "Unknown error"
          }));
          if (update.message) {
            await sendMessage(config.token, update.message.chat.id, `Chưa xử lý được lệnh. Mã theo dõi: ${errorId}. Dùng /status hoặc /health để kiểm tra.`);
          }
        }
      }
    } catch (error) {
      console.error(JSON.stringify({
        event: "telegram_poll_error",
        bot: config.role,
        retry_in_ms: retryDelayMs,
        detail: error instanceof Error ? error.message : "Unknown error"
      }));
      await wait(retryDelayMs);
      retryDelayMs = Math.min(retryDelayMs * 2, 30_000);
    }
  }
}

async function poll() {
  loadDotEnv();
  const configuredBots = getBotConfigs();
  const checks = await Promise.all(configuredBots.map(async (config) => {
    try {
      await telegramApi(config.token, "getMe", {});
      return { config, available: true };
    } catch (error) {
      console.error(JSON.stringify({ event: "telegram_bot_unavailable", bot: config.role, detail: error instanceof Error ? error.message : "Unknown error" }));
      return { config, available: false };
    }
  }));
  const configs = checks.filter((check) => check.available).map((check) => check.config);
  if (!configs.some((config) => config.role === "manager")) throw new Error("Marketing Manager Bot must be available.");
  const statePath = resolve(process.env.TELEGRAM_RUNTIME_STATE_PATH ?? "output/telegram-runtime-state.json");
  const fallback = () => createRuntimeSnapshot({
    telegramSession: createTelegramSession(seedData),
    workflow: createEmptyWorkflowState()
  });
  const loaded = await loadRuntimeSnapshot(statePath, fallback);
  const controller: RuntimeController = {
    snapshot: loaded.snapshot,
    statePath,
    mutationQueue: Promise.resolve()
  };
  await saveRuntimeSnapshot(statePath, controller.snapshot);

  console.log("AI Marketing Command Center Enterprise Stage-Gate is running.");
  console.log("Active bots:", configs.map((config) => config.displayName).join(", "));
  const unavailable = checks.filter((check) => !check.available).map((check) => check.config.displayName);
  if (unavailable.length) console.log("Manager relay enabled for:", unavailable.join(", "));
  console.log(`Runtime state: ${statePath}${loaded.recovered ? " (recovered from corrupt snapshot)" : ""}`);
  console.log("Use /campaign, /campaigns, /status, /approvals, /approve, /reject, /revise, /audit, /health.");
  await Promise.all(configs.map((config) => pollBot(config, configs, controller)));
}

poll().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

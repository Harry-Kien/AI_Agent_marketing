import { existsSync, readFileSync } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { seedData } from "../src/data/seed";
import { createControlApi } from "../src/integrations/controlApi";
import { createEmptyWorkflowState } from "../src/integrations/marketingWorkflow";
import { createTelegramSession } from "../src/integrations/telegramAdapter";
import { createRuntimeSnapshot, loadRuntimeSnapshot, saveRuntimeSnapshot } from "../src/integrations/telegramStateStore";
import { createAiProviderConfig } from "../src/integrations/aiProvider";
import { createApprovalPolicyConfig } from "../src/integrations/approvalPolicy";
import {
  approveActive,
  confirmPublicationFlow,
  rejectActive,
  requestPublication,
  startCampaign,
  type OrchestratorContext
} from "../src/integrations/campaignOrchestrator";
import { createMetaGraphClient, createMetaGraphConfig } from "../src/integrations/metaGraphAdapter";
import { loadAppConfig } from "../src/config/appConfig";
import { createLogger } from "../src/lib/logger";
import { embedKnowledgeBase, loadBrandKnowledge } from "../src/integrations/knowledgeBase";
import { createEmbeddingConfig } from "../src/integrations/embeddingProvider";
import { createTraceCollector } from "../src/integrations/telemetry";
import { appendCampaignMemory, buildCampaignMemory, loadCampaignMemories } from "../src/integrations/campaignMemory";
import { buildAnalyticsReadModel, sampleKpiTarget, sampleMetricSnapshot } from "../src/integrations/campaignAnalytics";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const value = line.trim(); if (!value || value.startsWith("#") || !value.includes("=")) continue;
  const [key, ...parts] = value.split("="); if (!process.env[key]) process.env[key] = parts.join("=").replace(/^["']|["']$/g, "");
}

const config = loadAppConfig(process.env);
const log = createLogger({ level: config.logLevel, service: "control-api" });
for (const warning of config.warnings) log.warn(warning);

const statePath = resolve(process.cwd(), config.statePath);
let snapshot = (await loadRuntimeSnapshot(statePath, () => createRuntimeSnapshot({ telegramSession: createTelegramSession(seedData), workflow: createEmptyWorkflowState() }))).snapshot;
let fingerprint = JSON.stringify(snapshot.workflow);

const brandKnowledge = loadBrandKnowledge(process.env.BRAND_KNOWLEDGE_PATH ? resolve(process.env.BRAND_KNOWLEDGE_PATH) : undefined);
const embedConfig = createEmbeddingConfig(process.env);
// Nhúng knowledge base MỘT LẦN lúc khởi động (hybrid retrieval); embedding tắt thì fallback BM25.
const knowledgeEmbeddings = await embedKnowledgeBase(brandKnowledge, embedConfig);
const semanticOn = knowledgeEmbeddings.some((vector) => vector && vector.length > 0);
log.info("Brand knowledge base đã nạp", {
  name: brandKnowledge.name,
  chunks: brandKnowledge.chunks.length,
  retrieval: semanticOn ? "hybrid (dense + BM25)" : "BM25 (chưa cắm embedding)"
});

const traces = createTraceCollector(200);
const memoryPath = resolve(dirname(statePath), "campaign-memory.json");
let memories = loadCampaignMemories(memoryPath);
log.info("Ký ức chiến dịch đã nạp", { count: memories.length });

const orchestratorContext = (): OrchestratorContext => ({
  ai: createAiProviderConfig(process.env),
  policy: createApprovalPolicyConfig(process.env),
  knowledge: brandKnowledge,
  knowledgeEmbeddings,
  embedConfig,
  memories,
  onSpan: (span) => traces.record(span),
  env: process.env
});

// Publisher thật chỉ dùng khi Meta được bật; nếu không, orchestrator hoàn tất bằng bằng chứng mock.
function metaPublisher() {
  const config = createMetaGraphConfig(process.env);
  if (!config.publishEnabled) return undefined;
  const client = createMetaGraphClient(config);
  return async (message: string) => client.publish({ message, confirmationText: message, approvalId: `dashboard:${Date.now()}` });
}

// Hàng đợi tuần tự hóa các hành động ghi để tránh race giữa các request.
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.then(() => undefined, () => undefined);
  return run;
}

// Giữ tối đa 10 bản backup có timestamp để phục hồi khi state chính hỏng (durability).
const backupDir = resolve(dirname(statePath), "backups");
async function rotateBackup() {
  try {
    await mkdir(backupDir, { recursive: true });
    await writeFile(join(backupDir, `state-${Date.now()}.json`), `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    const files = (await readdir(backupDir)).filter((name) => name.startsWith("state-")).sort();
    for (const stale of files.slice(0, Math.max(0, files.length - 10))) {
      await rm(join(backupDir, stale), { force: true });
    }
  } catch (error) {
    log.warn("Không tạo được backup state", { reason: error instanceof Error ? error.message : "unknown" });
  }
}

async function commit(nextWorkflow: typeof snapshot.workflow) {
  snapshot = { ...snapshot, workflow: nextWorkflow };
  await saveRuntimeSnapshot(statePath, snapshot);
  fingerprint = JSON.stringify(snapshot.workflow);
  await rotateBackup();
  api.broadcast(snapshot);
}

const distDir = resolve(process.cwd(), "dist");
const api = createControlApi({
  getSnapshot: () => snapshot,
  env: process.env,
  token: config.controlApi.token,
  host: config.controlApi.host,
  port: config.controlApi.port,
  staticDir: distDir,
  getSpans: () => traces.list(),
  getMemories: () => memories,
  actions: {
    createCampaign: (brief) =>
      enqueue(async () => commit(await startCampaign(snapshot.workflow, orchestratorContext(), { brief, createdBy: "dashboard-operator" }))),
    approveActive: () =>
      enqueue(async () => commit(await approveActive(snapshot.workflow, orchestratorContext(), "dashboard-operator"))),
    rejectActive: (feedback) =>
      enqueue(async () => commit(await rejectActive(snapshot.workflow, orchestratorContext(), { feedback, actorId: "dashboard-operator" }))),
    requestPublication: () =>
      enqueue(async () => commit(requestPublication(snapshot.workflow, "dashboard-operator"))),
    replyCommunity: ({ messageId, reply }) => {
      // Phản hồi đã được người vận hành duyệt. Gửi Meta thật cần META_AUTO_REPLY_ENABLED + Graph comment API (guarded).
      log.info("Phản hồi cộng đồng đã duyệt", {
        messageId,
        replyPreview: reply.slice(0, 80),
        metaAutoReply: process.env.META_AUTO_REPLY_ENABLED === "true"
      });
    },
    confirmPublication: () =>
      enqueue(async () => {
        const next = await confirmPublicationFlow(snapshot.workflow, { actorId: "dashboard-operator", publisher: metaPublisher() });
        await commit(next);
        // Học từ chiến dịch vừa xuất bản: ghi ký ức để agent dùng cho lần sau.
        const campaign = next.campaigns[next.campaigns.length - 1];
        if (campaign?.stage === "published") {
          const analytics = buildAnalyticsReadModel({ actual: sampleMetricSnapshot, target: sampleKpiTarget });
          memories = appendCampaignMemory(memoryPath, buildCampaignMemory({ campaignId: campaign.id, brief: campaign.brief, analytics }));
          log.info("Đã ghi ký ức chiến dịch", { campaignId: campaign.id, total: memories.length });
        }
      })
  }
});

await api.listen();
log.info(`Marketing Control API sẵn sàng: http://${api.host}:${api.port}`, {
  authRequired: Boolean(config.controlApi.token),
  nodeEnv: config.nodeEnv
});
log.info("Write-path bật: dashboard có thể tạo chiến dịch, duyệt, từ chối và xác nhận xuất bản.");

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    log.info(`Nhận ${signal}, đóng Control API an toàn.`);
    api.server.close(() => process.exit(0));
  });
}

// Đọc lại state từ đĩa để đồng bộ khi telegram-bot chạy song song; bỏ qua nếu trùng dấu vân tay của ta.
setInterval(async () => {
  const next = (await loadRuntimeSnapshot(statePath, () => snapshot)).snapshot;
  const nextFingerprint = JSON.stringify(next.workflow);
  if (nextFingerprint !== fingerprint) {
    snapshot = next;
    fingerprint = nextFingerprint;
    api.broadcast(snapshot);
  }
}, 750);

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
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

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const value = line.trim(); if (!value || value.startsWith("#") || !value.includes("=")) continue;
  const [key, ...parts] = value.split("="); if (!process.env[key]) process.env[key] = parts.join("=").replace(/^["']|["']$/g, "");
}

const statePath = resolve(process.cwd(), process.env.TELEGRAM_RUNTIME_STATE_PATH ?? "output/telegram-runtime-state.json");
let snapshot = (await loadRuntimeSnapshot(statePath, () => createRuntimeSnapshot({ telegramSession: createTelegramSession(seedData), workflow: createEmptyWorkflowState() }))).snapshot;
let fingerprint = JSON.stringify(snapshot.workflow);

const orchestratorContext = (): OrchestratorContext => ({
  ai: createAiProviderConfig(process.env),
  policy: createApprovalPolicyConfig(process.env)
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

async function commit(nextWorkflow: typeof snapshot.workflow) {
  snapshot = { ...snapshot, workflow: nextWorkflow };
  await saveRuntimeSnapshot(statePath, snapshot);
  fingerprint = JSON.stringify(snapshot.workflow);
  api.broadcast(snapshot);
}

const api = createControlApi({
  getSnapshot: () => snapshot,
  env: process.env,
  actions: {
    createCampaign: (brief) =>
      enqueue(async () => commit(await startCampaign(snapshot.workflow, orchestratorContext(), { brief, createdBy: "dashboard-operator" }))),
    approveActive: () =>
      enqueue(async () => commit(await approveActive(snapshot.workflow, orchestratorContext(), "dashboard-operator"))),
    rejectActive: (feedback) =>
      enqueue(async () => commit(await rejectActive(snapshot.workflow, orchestratorContext(), { feedback, actorId: "dashboard-operator" }))),
    requestPublication: () =>
      enqueue(async () => commit(requestPublication(snapshot.workflow, "dashboard-operator"))),
    confirmPublication: () =>
      enqueue(async () => commit(await confirmPublicationFlow(snapshot.workflow, { actorId: "dashboard-operator", publisher: metaPublisher() })))
  }
});

await api.listen();
console.log(`Marketing Control API: http://${api.host}:${api.port}`);
console.log("Write-path bật: dashboard có thể tạo chiến dịch, duyệt, từ chối và xác nhận xuất bản.");

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

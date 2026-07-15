import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { seedData } from "../src/data/seed";
import { createControlApi } from "../src/integrations/controlApi";
import { createEmptyWorkflowState } from "../src/integrations/marketingWorkflow";
import { createTelegramSession } from "../src/integrations/telegramAdapter";
import { createRuntimeSnapshot, loadRuntimeSnapshot } from "../src/integrations/telegramStateStore";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const value = line.trim(); if (!value || value.startsWith("#") || !value.includes("=")) continue;
  const [key, ...parts] = value.split("="); if (!process.env[key]) process.env[key] = parts.join("=").replace(/^["']|["']$/g, "");
}

const statePath = resolve(process.cwd(), process.env.TELEGRAM_RUNTIME_STATE_PATH ?? "output/telegram-runtime-state.json");
let snapshot = (await loadRuntimeSnapshot(statePath, () => createRuntimeSnapshot({ telegramSession: createTelegramSession(seedData), workflow: createEmptyWorkflowState() }))).snapshot;
const api = createControlApi({ getSnapshot: () => snapshot });
await api.listen();
console.log(`Marketing Control API: http://${api.host}:${api.port}`);
let fingerprint = JSON.stringify(snapshot.workflow);
setInterval(async () => {
  const next = (await loadRuntimeSnapshot(statePath, () => snapshot)).snapshot;
  const nextFingerprint = JSON.stringify(next.workflow);
  snapshot = next;
  if (nextFingerprint !== fingerprint) {
    fingerprint = nextFingerprint;
    api.broadcast(snapshot);
  }
}, 500);

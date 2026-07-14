import { access, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { MarketingWorkflowState } from "./marketingWorkflow";
import type { TelegramSession } from "./telegramAdapter";

export interface TelegramRuntimeSnapshot {
  schemaVersion: 1;
  telegramSession: TelegramSession;
  workflow: MarketingWorkflowState;
  botOffsets: Record<string, number>;
  processedUpdateIds: number[];
  savedAt: string;
}

export interface RuntimeSnapshotLoadResult {
  snapshot: TelegramRuntimeSnapshot;
  recovered: boolean;
  quarantinePath?: string;
}

function cloneSnapshot(snapshot: TelegramRuntimeSnapshot): TelegramRuntimeSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as TelegramRuntimeSnapshot;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isRuntimeSnapshot(value: unknown): value is TelegramRuntimeSnapshot {
  if (!isRecord(value) || value.schemaVersion !== 1) return false;
  if (!isRecord(value.telegramSession) || !isRecord(value.workflow)) return false;
  if (!isRecord(value.botOffsets) || !Array.isArray(value.processedUpdateIds)) return false;
  const workflow = value.workflow as Record<string, unknown>;
  return (
    Array.isArray(workflow.campaigns) &&
    Array.isArray(workflow.runs) &&
    Array.isArray(workflow.auditEvents) &&
    value.processedUpdateIds.every((id) => Number.isInteger(id))
  );
}

export function createRuntimeSnapshot(input: {
  telegramSession: TelegramSession;
  workflow: MarketingWorkflowState;
  botOffsets?: Record<string, number>;
  processedUpdateIds?: number[];
  now?: () => string;
}): TelegramRuntimeSnapshot {
  const snapshot: TelegramRuntimeSnapshot = {
    schemaVersion: 1,
    telegramSession: input.telegramSession,
    workflow: input.workflow,
    botOffsets: input.botOffsets ?? {},
    processedUpdateIds: (input.processedUpdateIds ?? []).slice(-1_000),
    savedAt: (input.now ?? (() => new Date().toISOString()))()
  };
  return cloneSnapshot(snapshot);
}

export async function saveRuntimeSnapshot(
  path: string,
  snapshot: TelegramRuntimeSnapshot
) {
  if (!isRuntimeSnapshot(snapshot)) throw new Error("Invalid Telegram runtime snapshot.");
  await mkdir(dirname(path), { recursive: true });
  const next = cloneSnapshot(snapshot);
  next.savedAt = new Date().toISOString();
  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  try {
    await rename(temporaryPath, path);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "EEXIST" && code !== "EPERM") throw error;
    await rm(path, { force: true });
    await rename(temporaryPath, path);
  }
}

export async function loadRuntimeSnapshot(
  path: string,
  createFallback: () => TelegramRuntimeSnapshot
): Promise<RuntimeSnapshotLoadResult> {
  try {
    await access(path);
  } catch {
    return { snapshot: cloneSnapshot(createFallback()), recovered: false };
  }

  try {
    const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
    if (!isRuntimeSnapshot(parsed)) throw new Error("Unsupported runtime snapshot schema.");
    return { snapshot: cloneSnapshot(parsed), recovered: false };
  } catch {
    const quarantinePath = `${path}.corrupt-${Date.now()}`;
    await rename(path, quarantinePath);
    return {
      snapshot: cloneSnapshot(createFallback()),
      recovered: true,
      quarantinePath
    };
  }
}

export function hasProcessedUpdate(snapshot: TelegramRuntimeSnapshot, updateId: number) {
  return snapshot.processedUpdateIds.includes(updateId);
}

export function addProcessedUpdate(
  current: TelegramRuntimeSnapshot,
  updateId: number
): TelegramRuntimeSnapshot {
  if (hasProcessedUpdate(current, updateId)) return cloneSnapshot(current);
  const snapshot = cloneSnapshot(current);
  snapshot.processedUpdateIds = [...snapshot.processedUpdateIds, updateId].slice(-1_000);
  return snapshot;
}

export function setBotOffset(
  current: TelegramRuntimeSnapshot,
  role: string,
  offset: number
): TelegramRuntimeSnapshot {
  const snapshot = cloneSnapshot(current);
  snapshot.botOffsets[role] = Math.max(snapshot.botOffsets[role] ?? 0, offset);
  return snapshot;
}

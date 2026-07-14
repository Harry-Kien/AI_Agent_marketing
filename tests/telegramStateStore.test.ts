import { mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { seedData } from "../src/data/seed";
import { createEmptyWorkflowState } from "../src/integrations/marketingWorkflow";
import { createTelegramSession } from "../src/integrations/telegramAdapter";
import {
  addProcessedUpdate,
  createRuntimeSnapshot,
  hasProcessedUpdate,
  loadRuntimeSnapshot,
  saveRuntimeSnapshot
} from "../src/integrations/telegramStateStore";

async function tempStatePath() {
  const folder = await mkdtemp(join(tmpdir(), "telegram-stage-gate-"));
  return { folder, path: join(folder, "runtime.json") };
}

describe("Telegram runtime state store", () => {
  it("round-trips workflow, session, offsets and processed updates", async () => {
    const target = await tempStatePath();
    const snapshot = createRuntimeSnapshot({
      telegramSession: createTelegramSession(seedData),
      workflow: createEmptyWorkflowState(),
      botOffsets: { manager: 123, "market-radar": 456 },
      processedUpdateIds: [9, 10]
    });

    await saveRuntimeSnapshot(target.path, snapshot);
    const loaded = await loadRuntimeSnapshot(target.path, () => snapshot);

    expect(loaded.recovered).toBe(false);
    expect(loaded.snapshot.botOffsets.manager).toBe(123);
    expect(loaded.snapshot.processedUpdateIds).toEqual([9, 10]);
    expect(loaded.snapshot.telegramSession.data.repos.length).toBe(seedData.repos.length);
    expect(JSON.parse(await readFile(target.path, "utf8")).schemaVersion).toBe(1);
  });

  it("quarantines a corrupt snapshot and recovers with a clean state", async () => {
    const target = await tempStatePath();
    await writeFile(target.path, "{not-json", "utf8");
    const fallback = createRuntimeSnapshot({
      telegramSession: createTelegramSession(seedData),
      workflow: createEmptyWorkflowState()
    });

    const loaded = await loadRuntimeSnapshot(target.path, () => fallback);
    const files = await readdir(target.folder);

    expect(loaded.recovered).toBe(true);
    expect(loaded.snapshot.workflow.campaigns).toEqual([]);
    expect(files.some((name) => name.startsWith("runtime.json.corrupt-"))).toBe(true);
  });

  it("bounds processed update IDs and provides idempotency checks", () => {
    let snapshot = createRuntimeSnapshot({
      telegramSession: createTelegramSession(seedData),
      workflow: createEmptyWorkflowState()
    });
    for (let id = 1; id <= 1_050; id += 1) {
      snapshot = addProcessedUpdate(snapshot, id);
    }

    expect(snapshot.processedUpdateIds).toHaveLength(1_000);
    expect(hasProcessedUpdate(snapshot, 1)).toBe(false);
    expect(hasProcessedUpdate(snapshot, 51)).toBe(true);
    expect(hasProcessedUpdate(snapshot, 1_050)).toBe(true);
    expect(addProcessedUpdate(snapshot, 1_050).processedUpdateIds).toHaveLength(1_000);
  });
});

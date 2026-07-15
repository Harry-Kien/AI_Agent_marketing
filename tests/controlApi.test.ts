// @vitest-environment node
import { describe, expect, it } from "vitest";
import { seedData } from "../src/data/seed";
import { buildOfficeReadModel, createControlApi } from "../src/integrations/controlApi";
import { createCampaign, createEmptyWorkflowState } from "../src/integrations/marketingWorkflow";
import { createTelegramSession } from "../src/integrations/telegramAdapter";
import { createRuntimeSnapshot } from "../src/integrations/telegramStateStore";

describe("local control API read model", () => {
  it("exposes six agents and a redacted campaign view", () => {
    const workflow = createCampaign(createEmptyWorkflowState(), { brief: "AI cho SME", createdBy: "owner", idSuffix: "API" }).state;
    const model = buildOfficeReadModel(
      createRuntimeSnapshot({ telegramSession: createTelegramSession(seedData), workflow }),
      { MARKETING_APPROVAL_MODE: "enterprise-risk-based" }
    );
    expect(model.agents).toHaveLength(6);
    expect(model.campaignTitle).toBe("AI cho SME");
    expect(model.services.find(({ name }) => name === "Human approval")?.detail).toBe("Final + xuất bản");
    expect(JSON.stringify(model)).not.toContain("TOKEN");
  });

  it("streams a realtime runtime event over SSE", async () => {
    const snapshot = createRuntimeSnapshot({ telegramSession: createTelegramSession(seedData), workflow: createEmptyWorkflowState() });
    const api = createControlApi({ getSnapshot: () => snapshot, port: 0 });
    await api.listen();
    const address = api.server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind.");
    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/api/events`);
      const reader = response.body?.getReader();
      const first = await reader?.read();
      const text = new TextDecoder().decode(first?.value);
      expect(response.headers.get("content-type")).toContain("text/event-stream");
      expect(text).toContain("event: runtime");
      expect(text).toContain('"agents"');
      await reader?.cancel();
    } finally {
      api.server.close();
    }
  });
});

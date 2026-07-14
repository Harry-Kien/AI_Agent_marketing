import { describe, expect, it } from "vitest";
import { seedData } from "../src/data/seed";
import { buildOfficeReadModel } from "../src/integrations/controlApi";
import { createCampaign, createEmptyWorkflowState } from "../src/integrations/marketingWorkflow";
import { createTelegramSession } from "../src/integrations/telegramAdapter";
import { createRuntimeSnapshot } from "../src/integrations/telegramStateStore";

describe("local control API read model", () => {
  it("exposes six agents and a redacted campaign view", () => {
    const workflow = createCampaign(createEmptyWorkflowState(), { brief: "AI cho SME", createdBy: "owner", idSuffix: "API" }).state;
    const model = buildOfficeReadModel(createRuntimeSnapshot({ telegramSession: createTelegramSession(seedData), workflow }));
    expect(model.agents).toHaveLength(6);
    expect(model.campaignTitle).toBe("AI cho SME");
    expect(JSON.stringify(model)).not.toContain("TOKEN");
  });
});

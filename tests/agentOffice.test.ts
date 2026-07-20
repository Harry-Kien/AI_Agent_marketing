// @vitest-environment node
import { describe, expect, it } from "vitest";
import { officeFallback } from "../src/features/agent-office/api";

describe("agent office default fallback telemetry", () => {
  it("uses the offline fallback by default", () => {
    expect(officeFallback.connected).toBe(false);
  });

  it("contains exactly 6 marketing agent roles", () => {
    expect(officeFallback.agents).toHaveLength(6);
    const agentIds = officeFallback.agents.map((a) => a.id);
    expect(agentIds).toContain("manager");
    expect(agentIds).toContain("radar");
    expect(agentIds).toContain("copy");
    expect(agentIds).toContain("creative");
    expect(agentIds).toContain("brand");
    expect(agentIds).toContain("growth");
  });

  it("exposes the four critical service adapters", () => {
    expect(officeFallback.services).toHaveLength(4);
    const serviceNames = officeFallback.services.map((s) => s.name);
    expect(serviceNames).toContain("Telegram");
    expect(serviceNames).toContain("9Router");
    expect(serviceNames).toContain("Meta Page");
    expect(serviceNames).toContain("Human approval");
  });

  it("defines active stages helper logic mapping", () => {
    const getActiveAgentIdForStage = (stage: string) => {
      const cleanStage = stage.toLowerCase();
      if (cleanStage.includes("research")) return "radar";
      if (cleanStage.includes("content")) return "copy";
      if (cleanStage.includes("creative")) return "creative";
      if (cleanStage.includes("brand")) return "brand";
      if (cleanStage.includes("final")) return "manager";
      if (cleanStage.includes("publish")) return "growth";
      return "manager";
    };

    expect(getActiveAgentIdForStage("creative_pending_approval")).toBe("creative");
    expect(getActiveAgentIdForStage("research_running")).toBe("radar");
    expect(getActiveAgentIdForStage("content_pending_approval")).toBe("copy");
  });
});

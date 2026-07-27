// @vitest-environment node
import { describe, expect, it } from "vitest";
import { resolveModelRouting, tierCostPer1kTokens, tierOf } from "../src/integrations/modelRouter";

describe("model router", () => {
  it("giao vai trò khó cho tier mạnh, việc nhẹ cho tier rẻ", () => {
    expect(tierOf("manager", {})).toBe("strong");
    expect(tierOf("performance-brand", {})).toBe("strong");
    expect(tierOf("content-creator", {})).toBe("balanced");
    expect(tierOf("page-growth", {})).toBe("light");
  });

  it("override tier theo vai trò qua env", () => {
    expect(tierOf("page-growth", { MODEL_TIER_PAGE_GROWTH: "strong" })).toBe("strong");
  });

  it("override model theo tier qua env", () => {
    const routing = resolveModelRouting("manager", { MODEL_STRONG: "anthropic/claude-x" });
    expect(routing.tier).toBe("strong");
    expect(routing.model).toBe("anthropic/claude-x");
  });

  it("có bảng chi phí cho mọi tier (phục vụ theo dõi cost)", () => {
    for (const tier of ["strong", "balanced", "light"] as const) {
      expect(tierCostPer1kTokens[tier].input).toBeGreaterThan(0);
      expect(tierCostPer1kTokens[tier].output).toBeGreaterThan(0);
    }
  });
});

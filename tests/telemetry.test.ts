// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  buildTelemetryReadModel,
  createTraceCollector,
  estimateCostUsd,
  estimateTokens,
  type AgentSpan
} from "../src/integrations/telemetry";

function span(overrides: Partial<AgentSpan> = {}): AgentSpan {
  return {
    runId: "r1",
    campaignId: "CMP-1",
    role: "market-radar",
    stage: "research",
    model: "openai/gpt-4.1-mini",
    tier: "balanced",
    mode: "mock",
    tokensIn: 500,
    tokensOut: 300,
    costUsd: 0.001,
    evalScore: 80,
    verdict: "pass",
    durationMs: 120,
    at: "2026-07-22T10:00:00.000Z",
    ...overrides
  };
}

describe("telemetry ước lượng", () => {
  it("estimateTokens ~ ký tự/4", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("a".repeat(400))).toBe(100);
  });

  it("tier mạnh đắt hơn tier nhẹ cùng lượng token", () => {
    expect(estimateCostUsd("strong", 1000, 1000)).toBeGreaterThan(estimateCostUsd("light", 1000, 1000));
  });
});

describe("trace collector", () => {
  it("giữ tối đa max span gần nhất", () => {
    const collector = createTraceCollector(2);
    collector.record(span({ runId: "a" }));
    collector.record(span({ runId: "b" }));
    collector.record(span({ runId: "c" }));
    expect(collector.list().map((s) => s.runId)).toEqual(["b", "c"]);
  });
});

describe("buildTelemetryReadModel", () => {
  it("tổng hợp chi phí, drift và không lộ nội dung", () => {
    const model = buildTelemetryReadModel(
      [
        span({ tier: "strong", costUsd: 0.02, verdict: "pass" }),
        span({ tier: "light", costUsd: 0.001, verdict: "block" })
      ],
      () => "2026-07-22T10:00:00.000Z"
    );
    expect(model.totals.spans).toBe(2);
    expect(model.totals.totalCostUsd).toBeCloseTo(0.021, 5);
    expect(model.totals.driftRatio).toBe(0.5); // 1/2 không pass
    expect(model.byTier.find((t) => t.tier === "strong")?.spans).toBe(1);
    // recent chỉ có metadata, không có tokensIn/tokensOut/durationMs thô
    const serialized = JSON.stringify(model.recent);
    expect(serialized).not.toContain("tokensIn");
    expect(serialized).not.toContain("durationMs");
  });
});

// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseMarketSignal } from "../src/domain/marketResearchTypes";
import {
  buildMarketInsights,
  buildMarketResearchReadModel,
  sampleMarketSignals
} from "../src/integrations/marketResearch";
import { defaultCompetitorEvents } from "../src/integrations/competitorMonitor";

const fixedNow = () => "2026-07-21T10:15:00.000Z";

describe("buildMarketInsights", () => {
  it("tổng hợp insight từ brief, tín hiệu thị trường và thay đổi đối thủ", () => {
    const insights = buildMarketInsights({
      campaignId: "CMP-1",
      brief: "Chiến dịch AI cho SME",
      signals: sampleMarketSignals,
      competitorEvents: defaultCompetitorEvents(fixedNow),
      now: fixedNow
    });
    expect(insights.some((i) => i.sourceType === "brief")).toBe(true);
    expect(insights.some((i) => i.sourceType === "observed_market")).toBe(true);
    expect(insights.some((i) => i.sourceType === "competitor")).toBe(true);
    // Mỗi insight phải có nguồn, bằng chứng, độ tin cậy và thời gian thu thập (F02).
    for (const insight of insights) {
      expect(insight.evidence.length).toBeGreaterThan(0);
      expect(insight.confidence).toBeGreaterThan(0);
      expect(insight.capturedAt).toBeTruthy();
    }
  });

  it("xếp hạng theo score giảm dần", () => {
    const insights = buildMarketInsights({
      campaignId: "CMP-1",
      brief: "AI cho SME",
      signals: sampleMarketSignals,
      now: fixedNow
    });
    const scores = insights.map((i) => i.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it("khử trùng insight trùng id", () => {
    const signal = sampleMarketSignals[0];
    const insights = buildMarketInsights({
      campaignId: "CMP-1",
      brief: "AI cho SME",
      signals: [signal, signal],
      now: fixedNow
    });
    const observed = insights.filter((i) => i.sourceType === "observed_market");
    expect(observed).toHaveLength(1);
  });

  it("insight quan sát thị trường tin cậy hơn brief", () => {
    const insights = buildMarketInsights({
      campaignId: "CMP-1",
      brief: "AI cho SME",
      signals: sampleMarketSignals,
      now: fixedNow
    });
    const brief = insights.find((i) => i.sourceType === "brief");
    const observed = insights.find((i) => i.sourceType === "observed_market");
    expect(observed!.confidence).toBeGreaterThan(brief!.confidence);
  });
});

describe("read model redacted", () => {
  it("map đúng shape và không lộ evidence/score/token", () => {
    const model = buildMarketResearchReadModel(
      { campaignId: "CMP-1", brief: "AI cho SME", signals: sampleMarketSignals, competitorEvents: defaultCompetitorEvents(fixedNow) },
      { now: fixedNow }
    );
    expect(model.topAngles.length).toBeGreaterThan(0);
    expect(model.insights.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(model);
    expect(serialized).not.toContain("evidence");
    expect(serialized).not.toContain("\"score\"");
    expect(serialized).not.toContain("TOKEN");
  });
});

describe("parse fixture đầu vào", () => {
  it("từ chối tín hiệu sai schema (failure path)", () => {
    expect(parseMarketSignal({ key: "" }).success).toBe(false);
    expect(parseMarketSignal(sampleMarketSignals[0]).success).toBe(true);
  });
});

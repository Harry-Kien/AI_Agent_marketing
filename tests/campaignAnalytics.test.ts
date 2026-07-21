// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseMetricSnapshot } from "../src/domain/analyticsTypes";
import {
  buildAnalyticsReadModel,
  buildLearningPackage,
  compareKpi,
  overallAttainment,
  sampleKpiTarget,
  sampleMetricSnapshot
} from "../src/integrations/campaignAnalytics";

const fixedNow = () => "2026-07-21T10:15:00.000Z";

describe("compareKpi", () => {
  it("phân loại above/on_track/below theo mức đạt", () => {
    const comparisons = compareKpi(sampleMetricSnapshot, sampleKpiTarget);
    const clicks = comparisons.find((c) => c.metric === "clicks");
    const leads = comparisons.find((c) => c.metric === "leads");
    const engagement = comparisons.find((c) => c.metric === "engagement");
    expect(clicks?.status).toBe("above"); // 910/800 = 1.14
    expect(leads?.status).toBe("below"); // 42/60 = 0.70
    expect(engagement?.status).toBe("on_track"); // 1400/1500 = 0.93
  });

  it("chỉ so sánh chỉ số có mục tiêu KPI", () => {
    const comparisons = compareKpi(sampleMetricSnapshot, sampleKpiTarget);
    expect(comparisons.some((c) => c.metric === "impressions")).toBe(false);
  });
});

describe("buildLearningPackage (F12)", () => {
  it("sinh bài học và đề xuất từ chỉ số dưới mục tiêu", () => {
    const comparisons = compareKpi(sampleMetricSnapshot, sampleKpiTarget);
    const learning = buildLearningPackage("CMP-DEMO-AI-SME", comparisons, fixedNow);
    expect(learning.lessons.length).toBeGreaterThan(0);
    expect(learning.recommendedActions.length).toBeGreaterThan(0);
    expect(learning.nextCampaignHypothesis).toContain("lead"); // leads yếu nhất
  });

  it("khi mọi KPI đạt thì vẫn đề xuất A/B", () => {
    const learning = buildLearningPackage(
      "CMP-1",
      [{ metric: "leads", actual: 60, target: 60, attainment: 1, status: "on_track" }],
      fixedNow
    );
    expect(learning.recommendedActions.some((a) => a.includes("A/B"))).toBe(true);
  });
});

describe("read model", () => {
  it("gộp KPI + bài học và tính overall attainment", () => {
    const model = buildAnalyticsReadModel({ actual: sampleMetricSnapshot, target: sampleKpiTarget, now: fixedNow });
    expect(model.kpis.length).toBe(5);
    expect(model.overallAttainment).toBeGreaterThan(0);
    expect(model.lessons.length).toBeGreaterThan(0);
    expect(model.overallAttainment).toBe(overallAttainment(model.kpis));
  });
});

describe("parse", () => {
  it("từ chối metric snapshot sai schema (failure path)", () => {
    expect(parseMetricSnapshot({ campaignId: "" }).success).toBe(false);
    expect(parseMetricSnapshot(sampleMetricSnapshot).success).toBe(true);
  });
});

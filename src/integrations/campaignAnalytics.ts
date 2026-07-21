import {
  metricKinds,
  type AnalyticsReadModel,
  type KpiComparison,
  type KpiStatus,
  type KpiTarget,
  type LearningPackage,
  type MetricKind,
  type MetricSnapshot
} from "../domain/analyticsTypes";

const nowIso = () => new Date().toISOString();

// Nhãn tiếng Việt của chỉ số để dùng trong bài học/đề xuất.
const metricLabels: Record<MetricKind, string> = {
  reach: "độ phủ",
  impressions: "lượt hiển thị",
  engagement: "tương tác",
  clicks: "lượt click",
  leads: "lead",
  conversions: "chuyển đổi"
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function statusOf(attainment: number): KpiStatus {
  if (attainment >= 1.05) return "above";
  if (attainment >= 0.9) return "on_track";
  return "below";
}

// So sánh chỉ số thực tế với KPI mục tiêu (F11).
export function compareKpi(actual: MetricSnapshot, target: KpiTarget): KpiComparison[] {
  const comparisons: KpiComparison[] = [];
  for (const metric of metricKinds) {
    const targetValue = target.targets[metric];
    if (targetValue === undefined) continue;
    const actualValue = actual.values[metric] ?? 0;
    const attainment = targetValue === 0 ? 0 : round2(actualValue / targetValue);
    comparisons.push({ metric, actual: actualValue, target: targetValue, attainment, status: statusOf(attainment) });
  }
  return comparisons;
}

export function overallAttainment(comparisons: KpiComparison[]): number {
  if (comparisons.length === 0) return 0;
  const sum = comparisons.reduce((total, item) => total + item.attainment, 0);
  return round2(sum / comparisons.length);
}

// Rút gói bài học từ so sánh KPI (F12 tự cải tiến).
export function buildLearningPackage(
  campaignId: string,
  comparisons: KpiComparison[],
  now: () => string = nowIso
): LearningPackage {
  const below = comparisons.filter((item) => item.status === "below");
  const above = comparisons.filter((item) => item.status === "above");

  const lessons: string[] = [];
  const recommendedActions: string[] = [];

  for (const item of below) {
    lessons.push(`Chỉ số ${metricLabels[item.metric]} chỉ đạt ${Math.round(item.attainment * 100)}% mục tiêu.`);
    recommendedActions.push(`Tối ưu ${metricLabels[item.metric]}: thử hook/CTA mới và điều chỉnh tệp nhắm.`);
  }
  for (const item of above) {
    lessons.push(`Chỉ số ${metricLabels[item.metric]} vượt mục tiêu (${Math.round(item.attainment * 100)}%).`);
    recommendedActions.push(`Nhân rộng yếu tố giúp ${metricLabels[item.metric]} vượt mục tiêu ở chiến dịch sau.`);
  }
  if (lessons.length === 0) {
    lessons.push("Toàn bộ KPI bám sát mục tiêu; giữ nguyên hướng tiếp cận hiện tại.");
    recommendedActions.push("Chạy biến thể A/B nhỏ để tìm dư địa cải thiện tiếp theo.");
  }

  const weakest = [...comparisons].sort((a, b) => a.attainment - b.attainment)[0];
  const nextCampaignHypothesis = weakest
    ? `Nếu tập trung cải thiện ${metricLabels[weakest.metric]} thì hiệu quả tổng thể chiến dịch tiếp theo sẽ tăng.`
    : "Cần thêm dữ liệu đo lường để đề xuất giả thuyết chiến dịch tiếp theo.";

  return { campaignId, generatedAt: now(), lessons, recommendedActions, nextCampaignHypothesis };
}

export interface AnalyticsInput {
  actual: MetricSnapshot;
  target: KpiTarget;
  connected?: boolean;
  now?: () => string;
}

// Read model đã redacted cho dashboard: gộp so sánh KPI + gói bài học.
export function buildAnalyticsReadModel(input: AnalyticsInput): AnalyticsReadModel {
  const now = input.now ?? nowIso;
  const comparisons = compareKpi(input.actual, input.target);
  const learning = buildLearningPackage(input.actual.campaignId, comparisons, now);
  return {
    connected: input.connected ?? true,
    campaignId: input.actual.campaignId,
    generatedAt: now(),
    kpis: comparisons,
    overallAttainment: overallAttainment(comparisons),
    lessons: learning.lessons,
    recommendedActions: learning.recommendedActions,
    nextCampaignHypothesis: learning.nextCampaignHypothesis
  };
}

// Fixture mẫu cho endpoint demo và test.
export const sampleKpiTarget: KpiTarget = {
  campaignId: "CMP-DEMO-AI-SME",
  targets: { reach: 20000, engagement: 1500, clicks: 800, leads: 60, conversions: 12 }
};

export const sampleMetricSnapshot: MetricSnapshot = {
  campaignId: "CMP-DEMO-AI-SME",
  capturedAt: "2026-07-21T10:00:00.000Z",
  values: { reach: 24500, engagement: 1400, clicks: 910, leads: 42, conversions: 9 }
};

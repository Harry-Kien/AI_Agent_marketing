import { z } from "zod";

// Các chỉ số đo lường chiến dịch (F11).
export const metricKinds = ["reach", "impressions", "engagement", "clicks", "leads", "conversions"] as const;
export type MetricKind = (typeof metricKinds)[number];

// Một lần đo thực tế của chiến dịch tại thời điểm thu thập.
export const metricSnapshotSchema = z.strictObject({
  campaignId: z.string().trim().min(1).max(80),
  capturedAt: z.string().trim().min(1).max(40), // ISO 8601
  values: z.partialRecord(z.enum(metricKinds), z.number().min(0))
});
export type MetricSnapshot = z.infer<typeof metricSnapshotSchema>;

// Mục tiêu KPI đã chốt trong brief/chiến dịch.
export const kpiTargetSchema = z.strictObject({
  campaignId: z.string().trim().min(1).max(80),
  targets: z.partialRecord(z.enum(metricKinds), z.number().min(0))
});
export type KpiTarget = z.infer<typeof kpiTargetSchema>;

export type KpiStatus = "above" | "on_track" | "below";

export interface KpiComparison {
  metric: MetricKind;
  actual: number;
  target: number;
  attainment: number; // actual/target, làm tròn 2 số
  status: KpiStatus;
}

// Gói bài học (F12 tự cải tiến): rút ra từ so sánh KPI.
export interface LearningPackage {
  campaignId: string;
  generatedAt: string;
  lessons: string[];
  recommendedActions: string[];
  nextCampaignHypothesis: string;
}

// Read model đã redacted cho Analytics & Learning Dashboard (B09).
export interface AnalyticsReadModel {
  connected: boolean;
  campaignId: string;
  generatedAt: string;
  kpis: KpiComparison[];
  overallAttainment: number;
  lessons: string[];
  recommendedActions: string[];
  nextCampaignHypothesis: string;
}

export function parseMetricSnapshot(value: unknown) {
  return metricSnapshotSchema.safeParse(value);
}

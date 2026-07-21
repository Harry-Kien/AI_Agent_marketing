import { z } from "zod";

// Phân loại insight thị trường (F02).
export const marketSignalCategories = ["trend", "pain_point", "audience", "opportunity"] as const;
export type MarketSignalCategory = (typeof marketSignalCategories)[number];

// Nguồn gốc của insight, dùng để suy ra độ tin cậy khi không khai báo tường minh.
export const insightSourceTypes = ["brief", "observed_market", "competitor", "assumption"] as const;
export type InsightSourceType = (typeof insightSourceTypes)[number];

// Một tín hiệu thị trường thô (fixture hoặc sau này từ nguồn thật).
export const marketSignalSchema = z.strictObject({
  key: z.string().trim().min(1).max(120),
  category: z.enum(marketSignalCategories),
  statement: z.string().trim().min(4).max(600),
  source: z.string().trim().min(1).max(200),
  capturedAt: z.string().trim().min(1).max(40), // ISO 8601
  // Trọng số quan trọng 0..1; nếu bỏ trống mặc định 0.5.
  weight: z.number().min(0).max(1).optional()
});
export type MarketSignal = z.infer<typeof marketSignalSchema>;

export interface InsightEvidence {
  source: string;
  capturedAt: string;
  note: string;
}

// Insight domain (giàu): có nguồn, bằng chứng, độ tin cậy và thời gian thu thập (đúng yêu cầu F02).
export interface MarketInsight {
  id: string;
  campaignId: string;
  category: MarketSignalCategory;
  statement: string;
  sourceType: InsightSourceType;
  confidence: number; // 0..1
  weight: number; // 0..1
  score: number; // confidence * weight, dùng để xếp hạng
  mediaAngle: string; // góc truyền thông dùng được
  evidence: InsightEvidence[];
  capturedAt: string;
}

// Read model đã redacted cho dashboard / Market Radar Agent.
export interface MarketInsightView {
  id: string;
  category: MarketSignalCategory;
  statement: string;
  sourceType: InsightSourceType;
  confidence: number;
  mediaAngle: string;
}

export interface MarketResearchReadModel {
  connected: boolean;
  campaignId: string;
  generatedAt: string;
  topAngles: string[];
  insights: MarketInsightView[];
}

export function parseMarketSignal(value: unknown) {
  return marketSignalSchema.safeParse(value);
}

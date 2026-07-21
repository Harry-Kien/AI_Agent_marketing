import { z } from "zod";

// Loại thay đổi của đối thủ mà hệ thống theo dõi (F03). Khớp 1:1 với UI CompetitorList.
export const competitorChangeTypes = [
  "pricing_change",
  "new_campaign",
  "feature_release",
  "ad_push"
] as const;
export type CompetitorChangeType = (typeof competitorChangeTypes)[number];

export const competitorImpacts = ["high", "medium", "low"] as const;
export type CompetitorImpact = (typeof competitorImpacts)[number];

// Một tín hiệu quan sát được về đối thủ tại thời điểm chụp (một dòng dữ liệu thô).
export const competitorSignalSchema = z.strictObject({
  category: z.enum(competitorChangeTypes),
  // Định danh ổn định của thứ được quan sát, ví dụ "plan:starter", "campaign:webinar-q3".
  key: z.string().trim().min(1).max(120),
  // Tên người đọc hiểu, ví dụ "Gói Starter".
  label: z.string().trim().min(1).max(160),
  // Giá trị hiện tại/ mô tả, ví dụ "4.2tr/tháng" hoặc nội dung chương trình.
  value: z.string().trim().min(1).max(600),
  // Ghi đè mức ảnh hưởng nếu nguồn dữ liệu đã biết rõ; nếu bỏ trống dùng bảng mặc định theo loại.
  impactHint: z.enum(competitorImpacts).optional()
});
export type CompetitorSignal = z.infer<typeof competitorSignalSchema>;

// Ảnh chụp trạng thái đối thủ tại một thời điểm. Diff engine so sánh hai ảnh để phát hiện thay đổi.
export const competitorSnapshotSchema = z.strictObject({
  competitorId: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  // Nguồn gốc dữ liệu, ví dụ "fixture:ad-library", "web:pricing-page".
  source: z.string().trim().min(1).max(200),
  // ISO 8601. Giữ dạng chuỗi để khớp pattern hiện có của repo.
  capturedAt: z.string().trim().min(1).max(40),
  signals: z.array(competitorSignalSchema).max(100)
});
export type CompetitorSnapshot = z.infer<typeof competitorSnapshotSchema>;

export interface CompetitorEvidence {
  source: string;
  capturedAt: string;
  note: string;
}

// Sự kiện thay đổi domain (giàu) do monitor sinh ra. dedupKey đảm bảo không cảnh báo trùng (K04).
export interface CompetitorChangeEvent {
  id: string;
  dedupKey: string;
  competitorId: string;
  name: string;
  type: CompetitorChangeType;
  changeKind: "new" | "changed";
  label: string;
  detail: string;
  previousValue?: string;
  currentValue: string;
  impact: CompetitorImpact;
  confidence: number; // 0..1
  recommendedResponse: string;
  source: string;
  detectedAt: string; // ISO 8601
  evidence: CompetitorEvidence[];
}

// Read model đã redacted cho dashboard. Khớp đúng interface CompetitorAlert mà UI của Bảo dùng,
// nhưng cố tình bỏ dedupKey/confidence/evidence nội bộ để không lộ chi tiết vận hành.
export interface CompetitorAlertView {
  id: string;
  name: string;
  type: CompetitorChangeType;
  detail: string;
  impact: CompetitorImpact;
  time: string; // HH:mm đã bản địa hóa
  suggestedAction: string;
}

export interface CompetitorReadModel {
  connected: boolean;
  generatedAt: string;
  alerts: CompetitorAlertView[];
}

export function parseCompetitorSnapshot(value: unknown) {
  return competitorSnapshotSchema.safeParse(value);
}

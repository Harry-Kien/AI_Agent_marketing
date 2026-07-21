import {
  type InsightSourceType,
  type MarketInsight,
  type MarketInsightView,
  type MarketResearchReadModel,
  type MarketSignal,
  type MarketSignalCategory
} from "../domain/marketResearchTypes";
import type { CompetitorChangeEvent } from "../domain/competitorTypes";

const nowIso = () => new Date().toISOString();

// Độ tin cậy mặc định theo nguồn: quan sát thị trường và đối thủ đáng tin hơn brief/giả định.
const confidenceBySource: Record<InsightSourceType, number> = {
  observed_market: 0.85,
  competitor: 0.8,
  brief: 0.6,
  assumption: 0.4
};

function stableHash(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return (hash >>> 0).toString(36);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function mediaAngleFor(category: MarketSignalCategory, statement: string): string {
  switch (category) {
    case "pain_point":
      return `Nhấn nỗi đau: ${statement}`;
    case "audience":
      return `Nhắm đúng tệp: ${statement}`;
    case "opportunity":
      return `Khai thác cơ hội: ${statement}`;
    case "trend":
      return `Cưỡi xu hướng: ${statement}`;
  }
}

function buildInsight(
  campaignId: string,
  category: MarketSignalCategory,
  statement: string,
  sourceType: InsightSourceType,
  evidence: MarketInsight["evidence"],
  weight: number,
  capturedAt: string,
  confidenceOverride?: number
): MarketInsight {
  const confidence = confidenceOverride ?? confidenceBySource[sourceType];
  const id = `${campaignId}::${category}::${stableHash(statement)}`;
  return {
    id,
    campaignId,
    category,
    statement,
    sourceType,
    confidence: round2(confidence),
    weight: round2(weight),
    score: round2(confidence * weight),
    mediaAngle: mediaAngleFor(category, statement),
    evidence,
    capturedAt
  };
}

export interface MarketResearchInput {
  campaignId: string;
  brief: string;
  signals?: MarketSignal[];
  competitorEvents?: CompetitorChangeEvent[];
  now?: () => string;
}

// Tổng hợp insight từ 3 nguồn: brief, tín hiệu thị trường quan sát được, và thay đổi đối thủ (tái dùng Module 1).
// Khử trùng theo id, xếp hạng theo score = confidence * weight.
export function buildMarketInsights(input: MarketResearchInput): MarketInsight[] {
  const now = input.now ?? nowIso;
  const byId = new Map<string, MarketInsight>();
  const add = (insight: MarketInsight) => {
    if (!byId.has(insight.id)) byId.set(insight.id, insight);
  };

  // Nguồn 1: chính brief của người quản lý.
  add(
    buildInsight(
      input.campaignId,
      "audience",
      `Yêu cầu chiến dịch: ${input.brief}`,
      "brief",
      [{ source: "manager-brief", capturedAt: now(), note: "Brief do người vận hành cung cấp." }],
      0.5,
      now()
    )
  );

  // Nguồn 2: tín hiệu thị trường quan sát được (fixture).
  for (const signal of input.signals ?? []) {
    add(
      buildInsight(
        input.campaignId,
        signal.category,
        signal.statement,
        "observed_market",
        [{ source: signal.source, capturedAt: signal.capturedAt, note: "Tín hiệu thị trường quan sát." }],
        signal.weight ?? 0.5,
        signal.capturedAt
      )
    );
  }

  // Nguồn 3: thay đổi đối thủ -> cơ hội truyền thông.
  for (const event of input.competitorEvents ?? []) {
    const weight = event.impact === "high" ? 0.9 : event.impact === "medium" ? 0.6 : 0.4;
    add(
      buildInsight(
        input.campaignId,
        "opportunity",
        `${event.name} — ${event.detail}`,
        "competitor",
        [{ source: event.source, capturedAt: event.detectedAt, note: event.recommendedResponse }],
        weight,
        event.detectedAt,
        event.confidence
      )
    );
  }

  return [...byId.values()].sort((a, b) => b.score - a.score);
}

// Read model đã redacted: bỏ evidence, weight, score, campaignId nội bộ.
export function buildMarketResearchReadModel(
  input: MarketResearchInput,
  options: { connected?: boolean; now?: () => string; topAngleCount?: number } = {}
): MarketResearchReadModel {
  const now = options.now ?? nowIso;
  const insights = buildMarketInsights({ ...input, now });
  const topAngleCount = options.topAngleCount ?? 3;
  return {
    connected: options.connected ?? true,
    campaignId: input.campaignId,
    generatedAt: now(),
    topAngles: insights.slice(0, topAngleCount).map((insight) => insight.mediaAngle),
    insights: insights.map(
      (insight) =>
        ({
          id: insight.id,
          category: insight.category,
          statement: insight.statement,
          sourceType: insight.sourceType,
          confidence: insight.confidence,
          mediaAngle: insight.mediaAngle
        } satisfies MarketInsightView)
    )
  };
}

// Fixture tín hiệu thị trường mẫu cho endpoint demo và test.
export const sampleMarketSignals: MarketSignal[] = [
  {
    key: "pain:manual-content",
    category: "pain_point",
    statement: "Chủ doanh nghiệp SME tốn quá nhiều giờ làm content thủ công mỗi tuần.",
    source: "fixture:sme-survey",
    capturedAt: "2026-07-19T09:00:00.000Z",
    weight: 0.85
  },
  {
    key: "audience:owner-5-30",
    category: "audience",
    statement: "Tệp chủ doanh nghiệp 5-30 nhân sự, tự vận hành marketing, ngân sách hạn chế.",
    source: "fixture:crm-segment",
    capturedAt: "2026-07-19T09:00:00.000Z",
    weight: 0.7
  },
  {
    key: "trend:ai-automation",
    category: "trend",
    statement: "Nhu cầu tự động hóa marketing bằng AI tăng mạnh trong khối SME Việt Nam.",
    source: "fixture:trend-report",
    capturedAt: "2026-07-18T09:00:00.000Z",
    weight: 0.75
  }
];

import { tierCostPer1kTokens, type ModelTier } from "./modelRouter";

// Span cho mỗi lần agent chạy (chuẩn tracing 2026): model, chi phí, eval, thời lượng.
export interface AgentSpan {
  runId: string;
  campaignId: string;
  role: string;
  stage: string;
  model: string;
  tier: ModelTier;
  mode: "ai" | "mock";
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  evalScore: number;
  verdict: "pass" | "revise" | "block";
  durationMs: number;
  at: string;
}

// Ước lượng token đơn giản (~4 ký tự/token) — dùng khi provider không trả usage thật.
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function estimateCostUsd(tier: ModelTier, tokensIn: number, tokensOut: number): number {
  const price = tierCostPer1kTokens[tier];
  return Math.round((((tokensIn * price.input) + (tokensOut * price.output)) / 1000) * 1_000_000) / 1_000_000;
}

export interface TraceCollector {
  record: (span: AgentSpan) => void;
  list: () => AgentSpan[];
}

// Bộ thu span trong bộ nhớ (ring buffer), giữ tối đa `max` span gần nhất.
export function createTraceCollector(max = 200): TraceCollector {
  const spans: AgentSpan[] = [];
  return {
    record: (span) => {
      spans.push(span);
      if (spans.length > max) spans.splice(0, spans.length - max);
    },
    list: () => [...spans]
  };
}

const tierRank: Record<ModelTier, number> = { strong: 0, balanced: 1, light: 2 };

// Read model đã redacted cho dashboard: chỉ metadata + chi phí, không lộ nội dung.
export function buildTelemetryReadModel(spans: AgentSpan[], now: () => string = () => new Date().toISOString()) {
  const totalCostUsd = Math.round(spans.reduce((sum, span) => sum + span.costUsd, 0) * 1_000_000) / 1_000_000;
  const avgEval = spans.length ? Math.round(spans.reduce((sum, span) => sum + span.evalScore, 0) / spans.length) : 0;
  const avgDurationMs = spans.length ? Math.round(spans.reduce((sum, span) => sum + span.durationMs, 0) / spans.length) : 0;

  const byTier: Record<ModelTier, { spans: number; costUsd: number }> = {
    strong: { spans: 0, costUsd: 0 },
    balanced: { spans: 0, costUsd: 0 },
    light: { spans: 0, costUsd: 0 }
  };
  for (const span of spans) {
    byTier[span.tier].spans += 1;
    byTier[span.tier].costUsd = Math.round((byTier[span.tier].costUsd + span.costUsd) * 1_000_000) / 1_000_000;
  }

  // Cảnh báo drift: tỉ lệ output bị eval chặn/revise cao.
  const flagged = spans.filter((span) => span.verdict !== "pass").length;
  const driftRatio = spans.length ? Math.round((flagged / spans.length) * 100) / 100 : 0;

  return {
    connected: true,
    generatedAt: now(),
    totals: {
      spans: spans.length,
      totalCostUsd,
      avgEvalScore: avgEval,
      avgDurationMs,
      driftRatio
    },
    byTier: (Object.keys(byTier) as ModelTier[])
      .sort((a, b) => tierRank[a] - tierRank[b])
      .map((tier) => ({ tier, ...byTier[tier] })),
    recent: [...spans]
      .slice(-20)
      .reverse()
      .map((span) => ({
        runId: span.runId,
        role: span.role,
        stage: span.stage,
        tier: span.tier,
        model: span.model,
        mode: span.mode,
        costUsd: span.costUsd,
        evalScore: span.evalScore,
        verdict: span.verdict,
        at: span.at
      }))
  };
}

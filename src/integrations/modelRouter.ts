import type { MarketingBotRole } from "./telegramAdapter";

// Định tuyến model theo agent: việc khó dùng model mạnh, việc nhẹ dùng model rẻ (chuẩn "models" 2026).
export type ModelTier = "strong" | "balanced" | "light";

const roleTier: Record<MarketingBotRole, ModelTier> = {
  manager: "strong", // điều phối + tổng hợp Final Package
  "performance-brand": "strong", // kiểm định rủi ro/claim/KPI — cần chính xác cao
  "market-radar": "balanced",
  "content-creator": "balanced",
  "creative-production": "balanced",
  "page-growth": "light" // vận hành, phân loại — tác vụ nhẹ
};

// Model mặc định mỗi tier (OpenAI-compatible/9Router). Override qua env MODEL_STRONG/BALANCED/LIGHT.
const defaultTierModel: Record<ModelTier, string> = {
  strong: "openai/gpt-4.1",
  balanced: "openai/gpt-4.1-mini",
  light: "openai/gpt-4.1-nano"
};

// Chi phí ước tính (USD / 1K token) mỗi tier — dùng cho theo dõi chi phí (module observability).
export const tierCostPer1kTokens: Record<ModelTier, { input: number; output: number }> = {
  strong: { input: 0.002, output: 0.008 },
  balanced: { input: 0.0004, output: 0.0016 },
  light: { input: 0.0001, output: 0.0004 }
};

export interface ModelRouting {
  role: MarketingBotRole;
  tier: ModelTier;
  model: string;
}

type EnvLike = Record<string, string | undefined>;

function roleEnvKey(role: MarketingBotRole): string {
  return role.toUpperCase().replace(/-/g, "_");
}

// Chọn tier + model cho một vai trò. Ưu tiên: env theo vai trò → env theo tier → mặc định.
export function resolveModelRouting(role: MarketingBotRole, env: EnvLike = process.env): ModelRouting {
  const tierOverride = env[`MODEL_TIER_${roleEnvKey(role)}`] as ModelTier | undefined;
  const tier = tierOverride && ["strong", "balanced", "light"].includes(tierOverride) ? tierOverride : roleTier[role];
  const model = env[`MODEL_${tier.toUpperCase()}`] ?? defaultTierModel[tier];
  return { role, tier, model };
}

export function tierOf(role: MarketingBotRole, env: EnvLike = process.env): ModelTier {
  return resolveModelRouting(role, env).tier;
}

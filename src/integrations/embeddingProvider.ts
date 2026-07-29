type EnvLike = Record<string, string | undefined>;
type FetchLike = typeof fetch;

// Cấu hình embedding. Guarded: chỉ bật khi có key hoặc cờ EMBEDDING_ENABLED.
export interface EmbeddingConfig {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
}

export function createEmbeddingConfig(env: EnvLike): EmbeddingConfig {
  const apiKey = env.EMBEDDING_API_KEY ?? env.NINE_ROUTER_API_KEY ?? "";
  const forced = ["1", "true", "yes", "on"].includes((env.EMBEDDING_ENABLED ?? "").toLowerCase());
  return {
    enabled: Boolean(apiKey) || forced,
    baseUrl: (env.EMBEDDING_BASE_URL ?? env.NINE_ROUTER_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, ""),
    apiKey,
    model: env.EMBEDDING_MODEL ?? "text-embedding-3-small",
    timeoutMs: Number.isInteger(Number(env.EMBEDDING_TIMEOUT_MS)) ? Number(env.EMBEDDING_TIMEOUT_MS) : 20_000
  };
}

// Nhúng danh sách văn bản. Trả null khi tắt/lỗi (guarded) để caller tự fallback lexical.
export async function embedTexts(
  config: EmbeddingConfig,
  texts: string[],
  fetchImpl: FetchLike = fetch
): Promise<number[][] | null> {
  if (!config.enabled || texts.length === 0) return null;
  try {
    const response = await fetchImpl(`${config.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {})
      },
      signal: AbortSignal.timeout(config.timeoutMs),
      body: JSON.stringify({ model: config.model, input: texts })
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
    const vectors = payload.data?.map((item) => item.embedding ?? []);
    if (!vectors || vectors.length !== texts.length || vectors.some((vector) => vector.length === 0)) return null;
    return vectors;
  } catch {
    return null;
  }
}

export async function embedOne(
  config: EmbeddingConfig,
  text: string,
  fetchImpl: FetchLike = fetch
): Promise<number[] | null> {
  const vectors = await embedTexts(config, [text], fetchImpl);
  return vectors ? vectors[0] : null;
}

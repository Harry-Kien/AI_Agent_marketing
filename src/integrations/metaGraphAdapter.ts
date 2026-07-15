export interface MetaGraphConfig {
  pageId: string;
  pageAccessToken: string;
  apiVersion: string;
  publishEnabled: boolean;
  timeoutMs: number;
}

export interface MetaPageIdentity { id: string; name: string }
export interface MetaPageSummary extends MetaPageIdentity { fan_count?: number; followers_count?: number }
export interface ConfirmedPublicationInput { message: string; approvalId: string; confirmationText: string }
export interface MetaPublicationEvidence { postId: string; permalink?: string }
type EnvLike = Record<string, string | undefined>;
type FetchLike = typeof fetch;

export function createMetaGraphConfig(env: EnvLike): MetaGraphConfig {
  return {
    pageId: env.META_PAGE_ID ?? "",
    pageAccessToken: env.META_PAGE_ACCESS_TOKEN ?? "",
    apiVersion: env.META_GRAPH_API_VERSION ?? "v23.0",
    publishEnabled: ["1", "true", "yes", "on"].includes((env.META_PUBLISH_ENABLED ?? "").toLowerCase()),
    timeoutMs: Number(env.META_TIMEOUT_MS) > 0 ? Number(env.META_TIMEOUT_MS) : 20_000
  };
}

export function createMetaGraphClient(config: MetaGraphConfig, fetchImpl: FetchLike = fetch) {
  const requireIdentity = () => {
    if (!config.pageId || !config.pageAccessToken) throw new Error("Meta Page credentials are not configured.");
  };
  const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
    requireIdentity();
    const response = await fetchImpl(`https://graph.facebook.com/${config.apiVersion}/${path}`, {
      ...init,
      headers: { authorization: `Bearer ${config.pageAccessToken}`, "content-type": "application/json", ...(init?.headers ?? {}) },
      signal: AbortSignal.timeout(config.timeoutMs)
    });
    const payload = await response.json() as T;
    if (!response.ok) throw new Error(`Meta Graph request failed (${response.status}).`);
    return payload;
  };
  return {
    async checkPageIdentity(): Promise<MetaPageIdentity> {
      return request<MetaPageIdentity>(`${encodeURIComponent(config.pageId)}?${new URLSearchParams({ fields: "id,name" })}`);
    },
    async readPageSummary(): Promise<MetaPageSummary> {
      return request<MetaPageSummary>(`${encodeURIComponent(config.pageId)}?${new URLSearchParams({ fields: "id,name,fan_count,followers_count" })}`);
    },
    buildPublicationPreview(input: { message: string }) {
      return { pageId: config.pageId, message: input.message.trim(), publishEnabled: config.publishEnabled, requiresConfirmation: true };
    },
    async publish(input: ConfirmedPublicationInput): Promise<MetaPublicationEvidence> {
      if (!config.publishEnabled) throw new Error("Meta publication is disabled by policy.");
      if (!input.approvalId.trim()) throw new Error("Human approval evidence is required.");
      if (input.message.trim() !== input.confirmationText.trim()) throw new Error("Confirmed preview does not match publication content.");
      const result = await request<{ id: string }>(`${encodeURIComponent(config.pageId)}/feed`, {
        method: "POST",
        body: JSON.stringify({ message: input.message.trim() })
      });
      return { postId: result.id, permalink: `https://www.facebook.com/${result.id.replace("_", "/posts/")}` };
    },
    async readPostMetrics(postId: string) {
      return request<{ data: unknown[] }>(`${encodeURIComponent(postId)}/insights?${new URLSearchParams({ metric: "post_impressions,post_engaged_users" })}`);
    }
  };
}

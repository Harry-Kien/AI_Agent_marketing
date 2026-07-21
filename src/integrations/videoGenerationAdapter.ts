import {
  parseVideoJobRequest,
  type MediaAsset,
  type MediaType,
  type VideoAssetView,
  type VideoJob,
  type VideoJobRequest,
  type VideoStudioReadModel
} from "../domain/mediaTypes";

type EnvLike = Record<string, string | undefined>;
type FetchLike = typeof fetch;

const nowIso = () => new Date().toISOString();
const defaultBaseUrl = "https://api.videoprovider.example/v1";
const defaultTimeoutMs = 60_000;

export interface VideoProviderConfig {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  provider: string;
  timeoutMs: number;
}

// Guard: provider video thật chỉ bật khi có API key hoặc cờ enabled (giống Meta guard).
export function createVideoProviderConfig(env: EnvLike): VideoProviderConfig {
  const apiKey = env.VIDEO_PROVIDER_API_KEY ?? "";
  const forceEnabled = ["1", "true", "yes", "on"].includes((env.VIDEO_PROVIDER_ENABLED ?? "").toLowerCase());
  return {
    enabled: Boolean(apiKey) || forceEnabled,
    baseUrl: (env.VIDEO_PROVIDER_BASE_URL ?? defaultBaseUrl).replace(/\/$/, ""),
    apiKey,
    provider: env.VIDEO_PROVIDER_NAME ?? "mock-video",
    timeoutMs: Number.isInteger(Number(env.VIDEO_PROVIDER_TIMEOUT_MS))
      ? Number(env.VIDEO_PROVIDER_TIMEOUT_MS)
      : defaultTimeoutMs
  };
}

function stableHash(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return (hash >>> 0).toString(36);
}

// Các asset một video job phải sinh ra: storyboard, audio (giọng đọc), phụ đề, video.
const plannedAssetTypes: MediaType[] = ["storyboard", "audio", "subtitle", "video"];

function buildAssets(
  request: VideoJobRequest,
  checksum: string,
  provider: string,
  status: MediaAsset["status"],
  now: () => string,
  externalBaseUrl?: string
): MediaAsset[] {
  return plannedAssetTypes.map((type) => ({
    id: `${request.campaignId}::${type}::${checksum}`,
    campaignId: request.campaignId,
    type,
    status,
    provider,
    checksum,
    externalUrl: status === "ready" && externalBaseUrl ? `${externalBaseUrl}/${type}/${checksum}` : undefined,
    localPath: status === "ready" && !externalBaseUrl ? `output/media/${request.campaignId}/${type}-${checksum}` : undefined,
    createdAt: now()
  }));
}

// Tạo job ở trạng thái queued (thuần, xác định) — dùng làm điểm khởi đầu và cho idempotency.
export function createVideoJob(request: VideoJobRequest, now: () => string = nowIso): VideoJob {
  const checksum = stableHash(`${request.campaignId}|${request.script}|${request.durationSeconds}`);
  const timestamp = now();
  return {
    id: `${request.campaignId}::video::${checksum}`,
    campaignId: request.campaignId,
    status: "queued",
    mode: "mock",
    request,
    assets: buildAssets(request, checksum, "pending", "queued", now),
    checksum,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

// Tạo video: nếu provider bị khóa -> job mock READY có contract tương đương (DoD #5).
// Nếu bật provider mà lỗi/timeout -> fallback mock, không ném lỗi (guarded).
export async function generateVideoJob(
  config: VideoProviderConfig,
  request: VideoJobRequest,
  fetchImpl: FetchLike = fetch,
  now: () => string = nowIso
): Promise<VideoJob> {
  const parsed = parseVideoJobRequest(request);
  if (!parsed.success) {
    const base = createVideoJob(request, now);
    return { ...base, status: "failed", fallbackReason: "Video job request failed schema validation." };
  }

  const base = createVideoJob(request, now);

  if (!config.enabled) {
    return {
      ...base,
      mode: "mock",
      status: "ready",
      assets: buildAssets(request, base.checksum, config.provider, "ready", now)
    };
  }

  try {
    const response = await fetchImpl(`${config.baseUrl}/videos`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` },
      signal: AbortSignal.timeout(config.timeoutMs),
      body: JSON.stringify({
        campaign_id: request.campaignId,
        script: request.script,
        duration_seconds: request.durationSeconds,
        voice: request.voice,
        aspect_ratio: request.aspectRatio ?? "9:16"
      })
    });
    if (!response.ok) throw new Error(`Video provider unavailable: HTTP ${response.status}`);
    const payload = (await response.json()) as { url?: string };
    if (!payload.url) throw new Error("Video provider returned no url");
    return {
      ...base,
      mode: "provider",
      status: "ready",
      assets: buildAssets(request, base.checksum, config.provider, "ready", now, payload.url)
    };
  } catch (error) {
    return {
      ...base,
      mode: "mock",
      status: "ready",
      assets: buildAssets(request, base.checksum, config.provider, "ready", now),
      fallbackReason: error instanceof Error ? error.message : "Video provider unavailable."
    };
  }
}

// Read model đã redacted: bỏ script thô, checksum, localPath, externalUrl.
export function buildVideoStudioReadModel(job: VideoJob, connected = true): VideoStudioReadModel {
  return {
    connected,
    campaignId: job.campaignId,
    jobId: job.id,
    status: job.status,
    mode: job.mode,
    title: job.request.title,
    durationSeconds: job.request.durationSeconds,
    generatedAt: job.updatedAt,
    assets: job.assets.map(
      (asset) =>
        ({
          type: asset.type,
          status: asset.status,
          provider: asset.provider,
          ready: asset.status === "ready"
        } satisfies VideoAssetView)
    )
  };
}

// Fixture request mẫu cho endpoint demo và test.
export const sampleVideoRequest: VideoJobRequest = {
  campaignId: "CMP-DEMO-AI-SME",
  title: "Video 30s giới thiệu AI Agent cho SME",
  script:
    "Cảnh 1: Chủ doanh nghiệp kiệt sức vì làm content thủ công. Cảnh 2: Đội AI Agent nhận việc 24/7. Cảnh 3: CTA đăng ký tư vấn.",
  durationSeconds: 30,
  voice: "vi-VN-female-warm",
  aspectRatio: "9:16"
};

import { z } from "zod";

// Trạng thái vòng đời asset/video job.
export const mediaStatuses = ["queued", "processing", "ready", "failed"] as const;
export type MediaStatus = (typeof mediaStatuses)[number];

export const mediaTypes = ["image", "video", "audio", "subtitle", "storyboard"] as const;
export type MediaType = (typeof mediaTypes)[number];

// Media Asset — khớp hợp đồng dùng chung (mục 8.2 tài liệu phân công).
export interface MediaAsset {
  id: string;
  campaignId: string;
  type: MediaType;
  status: MediaStatus;
  provider: string;
  localPath?: string;
  externalUrl?: string;
  checksum?: string;
  createdAt: string;
}

export const videoAspectRatios = ["9:16", "1:1", "16:9"] as const;
export type VideoAspectRatio = (typeof videoAspectRatios)[number];

// Yêu cầu tạo video từ nội dung ĐÃ DUYỆT.
export const videoJobRequestSchema = z.strictObject({
  campaignId: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(200),
  script: z.string().trim().min(10).max(5000),
  durationSeconds: z.number().int().min(5).max(180),
  voice: z.string().trim().min(1).max(60).optional(),
  aspectRatio: z.enum(videoAspectRatios).optional()
});
export type VideoJobRequest = z.infer<typeof videoJobRequestSchema>;

export interface VideoJob {
  id: string;
  campaignId: string;
  status: MediaStatus;
  mode: "provider" | "mock";
  request: VideoJobRequest;
  assets: MediaAsset[];
  checksum: string;
  fallbackReason?: string;
  createdAt: string;
  updatedAt: string;
}

// Read model đã redacted cho Content & Video Studio (B07).
export interface VideoAssetView {
  type: MediaType;
  status: MediaStatus;
  provider: string;
  ready: boolean;
}

export interface VideoStudioReadModel {
  connected: boolean;
  campaignId: string;
  jobId: string;
  status: MediaStatus;
  mode: "provider" | "mock";
  title: string;
  durationSeconds: number;
  assets: VideoAssetView[];
  generatedAt: string;
}

export function parseVideoJobRequest(value: unknown) {
  return videoJobRequestSchema.safeParse(value);
}

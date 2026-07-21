// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { parseVideoJobRequest } from "../src/domain/mediaTypes";
import {
  buildVideoStudioReadModel,
  createVideoJob,
  createVideoProviderConfig,
  generateVideoJob,
  sampleVideoRequest
} from "../src/integrations/videoGenerationAdapter";

const fixedNow = () => "2026-07-21T10:15:00.000Z";

describe("createVideoJob", () => {
  it("khởi tạo job queued với đủ 4 loại asset", () => {
    const job = createVideoJob(sampleVideoRequest, fixedNow);
    expect(job.status).toBe("queued");
    expect(job.assets.map((a) => a.type).sort()).toEqual(["audio", "storyboard", "subtitle", "video"]);
  });

  it("idempotent: cùng request cho ra cùng job id (checksum)", () => {
    const a = createVideoJob(sampleVideoRequest, fixedNow);
    const b = createVideoJob(sampleVideoRequest, fixedNow);
    expect(a.id).toBe(b.id);
  });
});

describe("generateVideoJob — guarded", () => {
  it("provider khóa -> job mock READY có contract tương đương (DoD #5)", async () => {
    const config = createVideoProviderConfig({});
    expect(config.enabled).toBe(false);
    const job = await generateVideoJob(config, sampleVideoRequest, fetch, fixedNow);
    expect(job.mode).toBe("mock");
    expect(job.status).toBe("ready");
    expect(job.assets.every((a) => a.status === "ready")).toBe(true);
  });

  it("provider bật và thành công -> mode provider với externalUrl", async () => {
    const config = createVideoProviderConfig({ VIDEO_PROVIDER_ENABLED: "true", VIDEO_PROVIDER_API_KEY: "k" });
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ url: "https://cdn.example/video" }), { status: 200 })
    ) as unknown as typeof fetch;
    const job = await generateVideoJob(config, sampleVideoRequest, fetchImpl, fixedNow);
    expect(job.mode).toBe("provider");
    expect(job.status).toBe("ready");
    expect(job.assets.find((a) => a.type === "video")?.externalUrl).toContain("cdn.example");
  });

  it("provider bật nhưng lỗi -> fallback mock, không ném lỗi", async () => {
    const config = createVideoProviderConfig({ VIDEO_PROVIDER_ENABLED: "true", VIDEO_PROVIDER_API_KEY: "k" });
    const fetchImpl = vi.fn(async () => new Response("boom", { status: 500 })) as unknown as typeof fetch;
    const job = await generateVideoJob(config, sampleVideoRequest, fetchImpl, fixedNow);
    expect(job.mode).toBe("mock");
    expect(job.status).toBe("ready");
    expect(job.fallbackReason).toContain("HTTP 500");
  });

  it("request sai schema -> job failed", async () => {
    const bad = { ...sampleVideoRequest, script: "ngắn" };
    const job = await generateVideoJob(createVideoProviderConfig({}), bad, fetch, fixedNow);
    expect(job.status).toBe("failed");
  });
});

describe("read model redacted", () => {
  it("không lộ script/checksum/localPath", async () => {
    const job = await generateVideoJob(createVideoProviderConfig({}), sampleVideoRequest, fetch, fixedNow);
    const model = buildVideoStudioReadModel(job);
    const serialized = JSON.stringify(model);
    expect(serialized).not.toContain("checksum");
    expect(serialized).not.toContain("localPath");
    expect(serialized).not.toContain(sampleVideoRequest.script);
    expect(model.assets).toHaveLength(4);
  });
});

describe("parse request", () => {
  it("từ chối request thiếu trường (failure path)", () => {
    expect(parseVideoJobRequest({ campaignId: "x" }).success).toBe(false);
    expect(parseVideoJobRequest(sampleVideoRequest).success).toBe(true);
  });
});

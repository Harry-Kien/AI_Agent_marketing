// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createEmbeddingConfig, embedOne, embedTexts } from "../src/integrations/embeddingProvider";

describe("createEmbeddingConfig (guarded)", () => {
  it("tắt khi không có key/cờ; bật khi có key", () => {
    expect(createEmbeddingConfig({}).enabled).toBe(false);
    expect(createEmbeddingConfig({ EMBEDDING_API_KEY: "k" }).enabled).toBe(true);
    expect(createEmbeddingConfig({ EMBEDDING_ENABLED: "true" }).enabled).toBe(true);
  });

  it("kế thừa base URL/key của 9Router nếu chưa đặt riêng", () => {
    const config = createEmbeddingConfig({ NINE_ROUTER_API_KEY: "k", NINE_ROUTER_BASE_URL: "http://gw/v1" });
    expect(config.enabled).toBe(true);
    expect(config.baseUrl).toBe("http://gw/v1");
  });
});

describe("embedTexts", () => {
  it("trả null khi tắt (fallback lexical)", async () => {
    expect(await embedTexts(createEmbeddingConfig({}), ["x"])).toBeNull();
  });

  it("trả vector khi provider ok", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2] }, { embedding: [0.3, 0.4] }] }), { status: 200 })
    ) as unknown as typeof fetch;
    const config = createEmbeddingConfig({ EMBEDDING_API_KEY: "k" });
    const vectors = await embedTexts(config, ["a", "b"], fetchImpl);
    expect(vectors).toEqual([[0.1, 0.2], [0.3, 0.4]]);
  });

  it("trả null khi provider lỗi hoặc số vector không khớp (guarded)", async () => {
    const err = vi.fn(async () => new Response("boom", { status: 500 })) as unknown as typeof fetch;
    expect(await embedOne(createEmbeddingConfig({ EMBEDDING_API_KEY: "k" }), "x", err)).toBeNull();

    const mismatch = vi.fn(async () => new Response(JSON.stringify({ data: [{ embedding: [1] }] }), { status: 200 })) as unknown as typeof fetch;
    expect(await embedTexts(createEmbeddingConfig({ EMBEDDING_API_KEY: "k" }), ["a", "b"], mismatch)).toBeNull();
  });
});

// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseBrandKnowledgeBase } from "../src/domain/knowledgeTypes";
import {
  embedKnowledgeBase,
  formatKnowledgeForPrompt,
  loadBrandKnowledge,
  retrieveKnowledge,
  retrieveKnowledgeSmart,
  sampleBrandKnowledge
} from "../src/integrations/knowledgeBase";
import { createEmbeddingConfig } from "../src/integrations/embeddingProvider";

describe("retrieveKnowledge (RAG-lite)", () => {
  it("trả về chunk liên quan nhất theo truy vấn", () => {
    const hits = retrieveKnowledge(sampleBrandKnowledge, "giá gói setup cho SME bao nhiêu", 3);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].chunk.id).toBe("pricing-setup-sme");
    expect(hits[0].score).toBeGreaterThan(0);
  });

  it("tìm đúng chính sách VAT", () => {
    const hits = retrieveKnowledge(sampleBrandKnowledge, "có xuất hóa đơn VAT không", 1);
    expect(hits[0].chunk.id).toBe("policy-vat");
  });

  it("trả rỗng khi không có từ khớp", () => {
    expect(retrieveKnowledge(sampleBrandKnowledge, "zzz xyz khôngtồntại", 3)).toHaveLength(0);
  });

  it("xếp hạng theo score giảm dần và giới hạn k", () => {
    const hits = retrieveKnowledge(sampleBrandKnowledge, "triển khai giá thương hiệu VAT khác biệt", 2);
    expect(hits.length).toBeLessThanOrEqual(2);
    if (hits.length === 2) expect(hits[0].score).toBeGreaterThanOrEqual(hits[1].score);
  });
});

describe("formatKnowledgeForPrompt", () => {
  it("tạo khối căn cứ, rỗng khi không có hit", () => {
    expect(formatKnowledgeForPrompt([])).toBe("");
    const block = formatKnowledgeForPrompt(retrieveKnowledge(sampleBrandKnowledge, "giá setup", 1));
    expect(block).toContain("CĂN CỨ THƯƠNG HIỆU");
    expect(block).toContain("4.900.000");
  });
});

describe("retrieveKnowledgeSmart (hybrid dense + BM25)", () => {
  // Embedding giả theo từ khóa để test xác định.
  const fakeEmbed = (async (_url: string, init?: RequestInit) => {
    const body = JSON.parse((init?.body as string) ?? "{}") as { input: string[] };
    const data = body.input.map((text) => ({
      embedding: [/giá/i.test(text) ? 1 : 0, /vat/i.test(text) ? 1 : 0, /triển/i.test(text) ? 1 : 0]
    }));
    return new Response(JSON.stringify({ data }), { status: 200 });
  }) as unknown as typeof fetch;

  it("fallback BM25 khi embedding tắt", async () => {
    const config = createEmbeddingConfig({});
    const embeddings = await embedKnowledgeBase(sampleBrandKnowledge, config);
    expect(embeddings.every((vector) => vector === undefined)).toBe(true);
    const hits = await retrieveKnowledgeSmart(sampleBrandKnowledge, "giá gói setup SME", { config, embeddings });
    expect(hits[0].chunk.id).toBe("pricing-setup-sme");
  });

  it("dùng hybrid khi có embedding (tìm đúng chính sách VAT)", async () => {
    const config = createEmbeddingConfig({ EMBEDDING_API_KEY: "k" });
    const embeddings = await embedKnowledgeBase(sampleBrandKnowledge, config, fakeEmbed);
    expect(embeddings.some((vector) => vector && vector.length > 0)).toBe(true);
    const hits = await retrieveKnowledgeSmart(sampleBrandKnowledge, "hóa đơn vat", { config, embeddings, fetchImpl: fakeEmbed });
    expect(hits.map((hit) => hit.chunk.id)).toContain("policy-vat");
  });
});

describe("loadBrandKnowledge", () => {
  it("dùng bản mẫu khi không có file", () => {
    expect(loadBrandKnowledge(undefined).chunks.length).toBeGreaterThan(0);
    expect(loadBrandKnowledge("/khong/ton/tai.json").name).toContain("mẫu");
  });

  it("validate schema knowledge base", () => {
    expect(parseBrandKnowledgeBase(sampleBrandKnowledge).success).toBe(true);
    expect(parseBrandKnowledgeBase({ name: "x" }).success).toBe(false);
  });
});

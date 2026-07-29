// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  cosineSimilarity,
  hybridRetrieve,
  lexicalScores,
  reciprocalRankFusion
} from "../src/integrations/semanticRetrieval";

describe("cosineSimilarity", () => {
  it("vector giống nhau = 1, vuông góc = 0", () => {
    expect(cosineSimilarity([1, 1], [1, 1])).toBeCloseTo(1, 5);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
  });
});

describe("lexicalScores (BM25-lite)", () => {
  it("doc khớp từ khóa có điểm dương", () => {
    const scores = lexicalScores(["giá gói setup SME", "mỹ phẩm thiên nhiên"], "giá setup");
    expect(scores[0]).toBeGreaterThan(0);
    expect(scores[1]).toBe(0);
  });
});

describe("reciprocalRankFusion", () => {
  it("doc đứng đầu ở nhiều bảng xếp hạng được ưu tiên", () => {
    const fused = reciprocalRankFusion([
      [10, 1, 0],
      [9, 2, 0]
    ]);
    expect(fused[0]).toBeGreaterThan(fused[1]);
    expect(fused[1]).toBeGreaterThan(fused[2]);
  });
});

describe("hybridRetrieve", () => {
  const docs = [
    { text: "giá gói thiết lập AI Agent cho SME", embedding: [1, 0, 0] },
    { text: "chính sách hóa đơn VAT", embedding: [0, 1, 0] },
    { text: "thời gian triển khai onboarding", embedding: [0, 0, 1] }
  ];

  it("không có embedding → suy biến lexical, lọc score>0", () => {
    const hits = hybridRetrieve(docs, "giá SME", null, 3);
    expect(hits[0].index).toBe(0);
    expect(hits.every((hit) => hit.score > 0)).toBe(true);
  });

  it("có embedding → tìm được doc gần ngữ nghĩa dù không khớp từ khóa", () => {
    // Query embedding gần doc VAT (index 1) dù text truy vấn không chứa 'VAT'.
    const hits = hybridRetrieve(docs, "hóa đơn thuế", [0, 1, 0], 2);
    expect(hits.map((hit) => hit.index)).toContain(1);
  });

  it("trả rỗng khi không khớp lexical và không có embedding", () => {
    expect(hybridRetrieve(docs, "zzz khôngtồntại", null, 3)).toHaveLength(0);
  });
});

// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { AgentWorkProduct } from "../src/integrations/agentWorkProduct";
import { evaluateAgentOutput, heuristicEval } from "../src/integrations/agentEval";

function product(overrides: Partial<AgentWorkProduct> = {}): AgentWorkProduct {
  return {
    summary: "Gói nội dung cho chiến dịch AI Agent giúp doanh nghiệp SME thu lead tư vấn hiệu quả.",
    deliverables: ["Bài Facebook có hook và CTA", "Biến thể A/B nhấn giá trị"],
    checks: ["Đúng tông thương hiệu"],
    risks: ["Cần kiểm chứng số liệu trước khi đăng"],
    evidence: ["Brief do người quản lý cung cấp về SME"],
    recommendation: "approve",
    approval_question: "Bạn có duyệt gói này để chuyển stage tiếp theo không?",
    quality_score: 82,
    ...overrides
  };
}

describe("heuristicEval", () => {
  it("output sạch, bám brief -> pass điểm cao", () => {
    const result = heuristicEval(product(), "chiến dịch AI Agent cho SME thu lead");
    expect(result.verdict).toBe("pass");
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.dimensions.brandSafety).toBe(100);
  });

  it("chặn (block) khi có claim phóng đại", () => {
    const result = heuristicEval(
      product({ summary: "Cam kết doanh thu x10, đảm bảo lợi nhuận 100% thành công cho mọi doanh nghiệp." }),
      "AI cho SME"
    );
    expect(result.verdict).toBe("block");
    expect(result.dimensions.brandSafety).toBeLessThan(50);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("hạ grounding khi evidence toàn giả định", () => {
    const result = heuristicEval(product({ evidence: ["Giả định thị trường", "Phỏng đoán nhu cầu"] }), "AI cho SME");
    expect(result.dimensions.grounding).toBeLessThan(60);
  });
});

describe("evaluateAgentOutput", () => {
  it("AI tắt -> dùng heuristic", async () => {
    const result = await evaluateAgentOutput(product(), { topic: "AI cho SME" });
    expect(result.mode).toBe("heuristic");
  });

  it("AI bật + judge trả JSON -> mode llm", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: '{"relevance":90,"brandSafety":95,"completeness":88,"grounding":90,"issues":[]}' } }] }), { status: 200 })
    ) as unknown as typeof fetch;
    const result = await evaluateAgentOutput(product(), {
      topic: "AI cho SME",
      ai: { enabled: true, baseUrl: "http://local", apiKey: "k", model: "judge" },
      fetchImpl
    });
    expect(result.mode).toBe("llm");
    expect(result.score).toBeGreaterThan(85);
  });

  it("AI bật nhưng lỗi -> fallback heuristic, không ném", async () => {
    const fetchImpl = vi.fn(async () => new Response("boom", { status: 500 })) as unknown as typeof fetch;
    const result = await evaluateAgentOutput(product(), {
      topic: "AI cho SME",
      ai: { enabled: true, baseUrl: "http://local", apiKey: "k", model: "judge" },
      fetchImpl
    });
    expect(result.mode).toBe("heuristic");
  });
});

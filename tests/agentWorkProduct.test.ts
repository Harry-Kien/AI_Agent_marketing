import { describe, expect, it } from "vitest";
import { formatAgentWorkProduct, parseAgentWorkProduct } from "../src/integrations/agentWorkProduct";

const valid = {
  summary: "Định vị AI Agent như một đội vận hành có kiểm soát.",
  deliverables: ["Insight SME", "Góc truyền thông tiết kiệm thời gian"],
  checks: ["Không dùng claim tuyệt đối"],
  risks: ["Thiếu dữ liệu khảo sát trực tiếp"],
  evidence: ["Brief chiến dịch do Admin cung cấp"],
  recommendation: "approve_with_conditions",
  approval_question: "Duyệt hướng định vị này để chuyển sang Content?",
  quality_score: 86
};

describe("structured agent work product", () => {
  it("validates and formats a complete work product for Telegram", () => {
    const parsed = parseAgentWorkProduct(JSON.stringify(valid));
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const text = formatAgentWorkProduct(parsed.data);
    expect(text).toContain("ĐIỂM CHẤT LƯỢNG: 86/100");
    expect(text).toContain("DELIVERABLES");
    expect(text).toContain("CHỜ QUYẾT ĐỊNH");
  });

  it("accepts JSON inside a markdown code fence", () => {
    expect(parseAgentWorkProduct(`\`\`\`json\n${JSON.stringify(valid)}\n\`\`\``).success).toBe(true);
  });

  it("rejects incomplete, low-quality or oversized output", () => {
    expect(parseAgentWorkProduct(JSON.stringify({ summary: "Thiếu trường" })).success).toBe(false);
    expect(parseAgentWorkProduct(JSON.stringify({ ...valid, quality_score: 42 })).success).toBe(false);
    expect(parseAgentWorkProduct(JSON.stringify({ ...valid, deliverables: Array(20).fill("x") })).success).toBe(false);
  });
});

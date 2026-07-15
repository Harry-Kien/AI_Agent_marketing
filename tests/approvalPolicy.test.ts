import { describe, expect, it } from "vitest";
import type { AgentWorkProduct } from "../src/integrations/agentWorkProduct";
import {
  createApprovalPolicyConfig,
  evaluateApprovalPolicy
} from "../src/integrations/approvalPolicy";

const product: AgentWorkProduct = {
  summary: "Gói marketing đầy đủ, có bằng chứng và sẵn sàng bàn giao nội bộ.",
  deliverables: ["Insight khách hàng đã cấu trúc", "Thông điệp chiến dịch có CTA"],
  checks: ["Không có claim tuyệt đối"],
  risks: ["Cần theo dõi hiệu quả sau khi triển khai"],
  evidence: ["Brief chiến dịch do Admin cung cấp"],
  recommendation: "approve",
  approval_question: "Có chuyển gói này sang phòng ban tiếp theo không?",
  quality_score: 86
};

function decide(overrides: Partial<Parameters<typeof evaluateApprovalPolicy>[0]> = {}) {
  return evaluateApprovalPolicy({
    config: createApprovalPolicyConfig({ MARKETING_APPROVAL_MODE: "enterprise-risk-based" }),
    stage: "research",
    product,
    outputMode: "ai",
    revisionCount: 0,
    ...overrides
  });
}

describe("enterprise risk-based approval policy", () => {
  it("defaults to enterprise mode and supports strict compatibility", () => {
    expect(createApprovalPolicyConfig({}).mode).toBe("enterprise-risk-based");
    expect(createApprovalPolicyConfig({ MARKETING_APPROVAL_MODE: "strict-stage-gate" }).mode).toBe("strict-stage-gate");
    expect(decide({ config: createApprovalPolicyConfig({ MARKETING_APPROVAL_MODE: "strict-stage-gate" }) }).action).toBe("human_approval");
  });

  it("auto-approves a high-quality internal package but never the final package", () => {
    expect(decide()).toMatchObject({ action: "auto_approve" });
    expect(decide({ stage: "final" })).toMatchObject({ action: "human_approval" });
  });

  it("auto-handoffs a conditional package for Brand and Manager to resolve before Final", () => {
    const conditional = {
      ...product,
      quality_score: 74,
      recommendation: "approve_with_conditions" as const,
      risks: ["Cần tránh claim cam kết doanh thu tuyệt đối"]
    };
    expect(decide({ product: conditional })).toMatchObject({ action: "auto_approve" });
  });

  it("escalates mock or fallback output", () => {
    expect(decide({ outputMode: "mock" })).toMatchObject({ action: "escalate" });
    expect(decide({ fallbackReason: "provider timeout" })).toMatchObject({ action: "escalate" });
  });

  it("auto-revises once then carries unresolved conditions to Brand and Manager", () => {
    const medium = { ...product, quality_score: 72, recommendation: "revise" as const };
    expect(decide({ product: medium, revisionCount: 0 })).toMatchObject({ action: "auto_revise" });
    expect(decide({ product: medium, revisionCount: 1 })).toMatchObject({ action: "auto_approve" });
  });

  it("escalates sensitive business and compliance risks", () => {
    for (const risk of [
      "Thu thập dữ liệu cá nhân",
      "Tư vấn pháp lý cho khách hàng",
      "Xử lý khiếu nại và khủng hoảng thương hiệu",
      "Đề nghị công khai dữ liệu tài chính"
    ]) {
      expect(decide({ product: { ...product, risks: [risk] } })).toMatchObject({ action: "escalate" });
    }
  });
});

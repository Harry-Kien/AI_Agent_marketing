import { describe, expect, it } from "vitest";
import type { AgentWorkProduct } from "../src/integrations/agentWorkProduct";
import {
  createApprovalPolicyConfig,
  evaluateApprovalPolicy
} from "../src/integrations/approvalPolicy";
import {
  completeRun,
  createCampaign,
  createEmptyWorkflowState,
  listPendingRuns
} from "../src/integrations/marketingWorkflow";
import { applyApprovalPolicyDecision } from "../src/integrations/workflowApproval";

const product: AgentWorkProduct = {
  summary: "Gói công việc đạt chuẩn bàn giao giữa các phòng ban marketing AI.",
  deliverables: ["Đầu ra chuyên môn hoàn chỉnh", "Hướng dẫn cho phòng ban tiếp theo"],
  checks: ["Đã kiểm tra phạm vi vai trò và dữ liệu đầu vào"],
  risks: ["Theo dõi chỉ số sau khi triển khai"],
  evidence: ["Brief và output phòng ban trước trong campaign"],
  recommendation: "approve",
  approval_question: "Có chuyển sang phòng ban tiếp theo không?",
  quality_score: 88
};

describe("enterprise auto-handoff sequence", () => {
  it("auto-handoffs four internal departments and asks Admin only for Final", () => {
    const config = createApprovalPolicyConfig({ MARKETING_APPROVAL_MODE: "enterprise-risk-based" });
    let state = createCampaign(createEmptyWorkflowState(), {
      brief: "AI Agent cho doanh nghiệp nhỏ",
      createdBy: "operator",
      idSuffix: "ENT"
    }).state;

    for (const stage of ["research", "content", "creative", "brand"] as const) {
      const run = state.runs.find((item) => item.status === "running" && item.stage === stage)!;
      state = completeRun(state, run.id, `${stage} package`).state;
      const decision = evaluateApprovalPolicy({
        config,
        stage,
        product,
        outputMode: "ai",
        revisionCount: 0
      });
      const applied = applyApprovalPolicyDecision(state, run.id, decision);
      expect(applied.nextRun).toBeDefined();
      state = applied.state;
    }

    const finalRun = state.runs.find((item) => item.status === "running" && item.stage === "final")!;
    state = completeRun(state, finalRun.id, "Final package").state;
    const finalDecision = evaluateApprovalPolicy({
      config,
      stage: "final",
      product,
      outputMode: "ai",
      revisionCount: 0
    });

    expect(finalDecision.action).toBe("human_approval");
    expect(listPendingRuns(state).map(({ id }) => id)).toEqual([finalRun.id]);
    expect(state.auditEvents.filter(({ action }) => action === "run_auto_approved")).toHaveLength(4);
    expect(state.auditEvents.filter(({ actorId }) => actorId === "policy-engine")).toHaveLength(4);
  });

  it("auto-revises once and then carries conditions forward without asking Admin", () => {
    const config = createApprovalPolicyConfig({ MARKETING_APPROVAL_MODE: "enterprise-risk-based" });
    const created = createCampaign(createEmptyWorkflowState(), {
      brief: "AI Agent cho doanh nghiệp nhỏ",
      createdBy: "operator",
      idSuffix: "REV"
    });
    let state = completeRun(created.state, created.run.id, "Research draft").state;
    const revisionProduct = { ...product, quality_score: 68, recommendation: "revise" as const };
    const firstDecision = evaluateApprovalPolicy({
      config,
      stage: "research",
      product: revisionProduct,
      outputMode: "ai",
      revisionCount: 0
    });
    const revised = applyApprovalPolicyDecision(state, created.run.id, firstDecision);
    expect(revised.nextRun?.stage).toBe("research");
    expect(revised.nextRun?.parentRunId).toBe(created.run.id);

    state = completeRun(revised.state, revised.nextRun!.id, "Research revision").state;
    const secondDecision = evaluateApprovalPolicy({
      config,
      stage: "research",
      product: revisionProduct,
      outputMode: "ai",
      revisionCount: 1
    });
    const handedOff = applyApprovalPolicyDecision(state, revised.nextRun!.id, secondDecision);

    expect(handedOff.nextRun?.stage).toBe("content");
    expect(handedOff.state.auditEvents.some(({ action }) => action === "auto_revision_started")).toBe(true);
    expect(handedOff.state.auditEvents.some(({ action }) => action === "run_auto_approved")).toBe(true);
  });
});

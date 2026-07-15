import type { AgentWorkProduct } from "./agentWorkProduct";
import type { MarketingRunStage } from "./marketingWorkflow";

export type ApprovalMode = "enterprise-risk-based" | "strict-stage-gate";
export type ApprovalPolicyAction =
  | "auto_approve"
  | "auto_revise"
  | "escalate"
  | "human_approval";

export interface ApprovalPolicyConfig {
  mode: ApprovalMode;
  autoApproveScore: number;
  conditionalHandoffScore: number;
  maxAutoRevisions: number;
}

export interface ApprovalPolicyDecision {
  action: ApprovalPolicyAction;
  reason: string;
  feedback?: string;
}

export interface ApprovalPolicyInput {
  config: ApprovalPolicyConfig;
  stage: MarketingRunStage;
  product: AgentWorkProduct;
  outputMode: "ai" | "mock";
  fallbackReason?: string;
  revisionCount: number;
}

type EnvLike = Record<string, string | undefined>;

const sensitiveRiskPattern = /(chi tiền|pháp lý|bảo mật|dữ liệu cá nhân|sức khỏe|tài chính|khiếu nại|khủng hoảng|thù ghét|xóa|chặn|chạy ads)/i;

export function createApprovalPolicyConfig(env: EnvLike): ApprovalPolicyConfig {
  const mode = env.MARKETING_APPROVAL_MODE === "strict-stage-gate"
    ? "strict-stage-gate"
    : "enterprise-risk-based";
  return {
    mode,
    autoApproveScore: readInteger(env.MARKETING_AUTO_APPROVE_SCORE, 80, 60, 100),
    conditionalHandoffScore: readInteger(env.MARKETING_CONDITIONAL_HANDOFF_SCORE, 70, 60, 100),
    maxAutoRevisions: readInteger(env.MARKETING_MAX_AUTO_REVISIONS, 1, 0, 3)
  };
}

export function evaluateApprovalPolicy(input: ApprovalPolicyInput): ApprovalPolicyDecision {
  if (input.config.mode === "strict-stage-gate") {
    return { action: "human_approval", reason: "Strict stage-gate requires human approval." };
  }
  if (input.stage === "final") {
    return { action: "human_approval", reason: "Final Package always requires Admin approval." };
  }
  if (input.outputMode !== "ai" || input.fallbackReason) {
    return {
      action: "escalate",
      reason: input.fallbackReason ?? "Mock output cannot be auto-approved."
    };
  }

  const sensitiveRisk = input.product.risks.find((risk) => sensitiveRiskPattern.test(risk));
  if (sensitiveRisk) {
    return {
      action: "escalate",
      reason: `Sensitive risk requires Admin review: ${sensitiveRisk}`
    };
  }

  if (
    input.product.quality_score >= input.config.autoApproveScore &&
    input.product.recommendation === "approve"
  ) {
    return {
      action: "auto_approve",
      reason: `Quality ${input.product.quality_score}/100 passed enterprise policy.`
    };
  }

  if (
    input.product.quality_score >= input.config.conditionalHandoffScore &&
    input.product.recommendation === "approve_with_conditions"
  ) {
    return {
      action: "auto_approve",
      reason: `Conditional handoff at ${input.product.quality_score}/100; Brand and Manager must resolve conditions before Final.`
    };
  }

  if (input.product.recommendation === "reject") {
    return {
      action: "escalate",
      reason: "Agent rejected the package."
    };
  }

  if (input.revisionCount >= input.config.maxAutoRevisions) {
    return {
      action: "auto_approve",
      reason: "Automatic revision limit reached; unresolved conditions are carried to Brand and Manager before Final."
    };
  }

  return {
    action: "auto_revise",
    reason: `Quality ${input.product.quality_score}/100 did not pass enterprise policy.`,
    feedback: [
      `Raise quality score to at least ${input.config.autoApproveScore}.`,
      `Resolve recommendation: ${input.product.recommendation}.`,
      ...input.product.risks.map((risk) => `Address risk: ${risk}`)
    ].join(" ").slice(0, 600)
  };
}

function readInteger(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

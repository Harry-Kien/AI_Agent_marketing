import type { ApprovalPolicyDecision } from "./approvalPolicy";
import {
  approveRun,
  recordRiskEscalation,
  rejectRun,
  reviseRun,
  type MarketingAgentRunRuntime,
  type MarketingWorkflowState
} from "./marketingWorkflow";

type Clock = () => string;

export interface AppliedApprovalPolicy {
  state: MarketingWorkflowState;
  run: MarketingAgentRunRuntime;
  nextRun?: MarketingAgentRunRuntime;
}

export function applyApprovalPolicyDecision(
  current: MarketingWorkflowState,
  runId: string,
  decision: ApprovalPolicyDecision,
  now: Clock = () => new Date().toISOString()
): AppliedApprovalPolicy {
  if (decision.action === "auto_approve") {
    const approved = approveRun(current, runId, "policy-engine", now, {
      actorType: "system",
      auditAction: "run_auto_approved"
    });
    return { state: approved.state, run: approved.run, nextRun: approved.nextRun };
  }

  if (decision.action === "auto_revise") {
    const feedback = decision.feedback ?? decision.reason;
    const rejected = rejectRun(current, runId, feedback, "policy-engine", now, {
      actorType: "system",
      auditAction: "run_rejected"
    });
    const revision = reviseRun(rejected.state, runId, feedback, "policy-engine", now, {
      actorType: "system",
      auditAction: "auto_revision_started"
    });
    return { state: revision.state, run: rejected.run, nextRun: revision.run };
  }

  if (decision.action === "escalate") {
    const escalated = recordRiskEscalation(current, runId, decision.reason, "policy-engine", now);
    return { state: escalated.state, run: escalated.run };
  }

  const run = current.runs.find((item) => item.id === runId);
  if (!run) throw new Error(`Run ${runId} does not exist.`);
  return { state: current, run };
}

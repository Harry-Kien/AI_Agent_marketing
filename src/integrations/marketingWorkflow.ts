import type { MarketingBotRole } from "./telegramAdapter";

export type MarketingCampaignStage =
  | "research_running"
  | "research_pending_approval"
  | "content_running"
  | "content_pending_approval"
  | "brand_running"
  | "brand_pending_approval"
  | "finalizing"
  | "final_pending_approval"
  | "rework_required"
  | "ready_to_execute"
  | "failed";

export type MarketingRunStage = "research" | "content" | "brand" | "final";
export type MarketingRunStatus =
  | "running"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "superseded"
  | "failed";

export interface MarketingCampaignRuntime {
  id: string;
  brief: string;
  stage: MarketingCampaignStage;
  activeRunId?: string;
  approvedRunIds: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface MarketingAgentRunRuntime {
  id: string;
  campaignId: string;
  stage: MarketingRunStage;
  role: MarketingBotRole;
  status: MarketingRunStatus;
  input: string;
  output: string;
  parentRunId?: string;
  revisionFeedback?: string;
  fallbackReason?: string;
  createdAt: string;
  updatedAt: string;
}

export type MarketingAuditAction =
  | "campaign_created"
  | "task_assigned"
  | "run_completed"
  | "run_approved"
  | "run_rejected"
  | "revision_started"
  | "provider_fallback"
  | "campaign_ready"
  | "runtime_recovered";

export interface TelegramAuditEvent {
  id: string;
  campaignId?: string;
  runId?: string;
  actorType: "human" | "agent" | "system";
  actorId: string;
  action: MarketingAuditAction;
  summary: string;
  createdAt: string;
}

export interface MarketingWorkflowState {
  campaigns: MarketingCampaignRuntime[];
  runs: MarketingAgentRunRuntime[];
  auditEvents: TelegramAuditEvent[];
}

type Clock = () => string;

const roles: Record<MarketingRunStage, MarketingBotRole> = {
  research: "market-radar",
  content: "content-creator",
  brand: "performance-brand",
  final: "manager"
};

const runningStages: Record<MarketingRunStage, MarketingCampaignStage> = {
  research: "research_running",
  content: "content_running",
  brand: "brand_running",
  final: "finalizing"
};

const pendingStages: Record<MarketingRunStage, MarketingCampaignStage> = {
  research: "research_pending_approval",
  content: "content_pending_approval",
  brand: "brand_pending_approval",
  final: "final_pending_approval"
};

const nextStages: Partial<Record<MarketingRunStage, MarketingRunStage>> = {
  research: "content",
  content: "brand",
  brand: "final"
};

function cloneState(state: MarketingWorkflowState): MarketingWorkflowState {
  return {
    campaigns: state.campaigns.map((campaign) => ({
      ...campaign,
      approvedRunIds: [...campaign.approvedRunIds]
    })),
    runs: state.runs.map((run) => ({ ...run })),
    auditEvents: state.auditEvents.map((event) => ({ ...event }))
  };
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, "0");
}

function campaignId(timestamp: string, suffix: string) {
  const date = timestamp.slice(0, 10).replace(/-/g, "");
  return `CMP-${date}-${suffix.toUpperCase().slice(-8)}`;
}

function stageCode(stage: MarketingRunStage) {
  return ({ research: "RSH", content: "CNT", brand: "BRD", final: "FIN" })[stage];
}

function createRunId(
  state: MarketingWorkflowState,
  campaign: MarketingCampaignRuntime,
  stage: MarketingRunStage
) {
  const campaignParts = campaign.id.split("-");
  const revision =
    state.runs.filter((run) => run.campaignId === campaign.id && run.stage === stage).length + 1;
  return `RUN-${campaignParts[campaignParts.length - 1]}-${stageCode(stage)}-${revision}`;
}

function audit(
  state: MarketingWorkflowState,
  input: Omit<TelegramAuditEvent, "id">
) {
  state.auditEvents.push({
    ...input,
    id: `AUD-${state.auditEvents.length + 1}-${input.createdAt.replace(/\D/g, "").slice(-8)}`
  });
  state.auditEvents = state.auditEvents.slice(-500);
}

function requireCampaign(state: MarketingWorkflowState, campaignIdValue: string) {
  const campaign = state.campaigns.find(({ id }) => id === campaignIdValue);
  if (!campaign) throw new Error(`Campaign ${campaignIdValue} does not exist.`);
  return campaign;
}

function requireRun(state: MarketingWorkflowState, runId: string) {
  const run = state.runs.find(({ id }) => id === runId);
  if (!run) throw new Error(`Run ${runId} does not exist.`);
  return run;
}

function createRunningRun(
  state: MarketingWorkflowState,
  campaign: MarketingCampaignRuntime,
  stage: MarketingRunStage,
  now: Clock,
  options: { parentRunId?: string; revisionFeedback?: string } = {}
) {
  const timestamp = now();
  const run: MarketingAgentRunRuntime = {
    id: createRunId(state, campaign, stage),
    campaignId: campaign.id,
    stage,
    role: roles[stage],
    status: "running",
    input: "",
    output: "",
    parentRunId: options.parentRunId,
    revisionFeedback: options.revisionFeedback,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  state.runs.push(run);
  campaign.activeRunId = run.id;
  campaign.stage = runningStages[stage];
  campaign.updatedAt = timestamp;
  run.input = buildStageInput(state, run.id);
  audit(state, {
    campaignId: campaign.id,
    runId: run.id,
    actorType: "system",
    actorId: "marketing-manager",
    action: "task_assigned",
    summary: `Assigned ${stage} stage to ${run.role}.`,
    createdAt: timestamp
  });
  return run;
}

export function createEmptyWorkflowState(): MarketingWorkflowState {
  return { campaigns: [], runs: [], auditEvents: [] };
}

export function createCampaign(
  current: MarketingWorkflowState,
  input: { brief: string; createdBy: string; now?: Clock; idSuffix?: string }
) {
  if (!input.brief.trim()) throw new Error("Campaign brief is required.");
  const now = input.now ?? (() => new Date().toISOString());
  const state = cloneState(current);
  const timestamp = now();
  const campaign: MarketingCampaignRuntime = {
    id: campaignId(timestamp, input.idSuffix ?? randomSuffix()),
    brief: input.brief.trim(),
    stage: "research_running",
    approvedRunIds: [],
    createdBy: input.createdBy,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  if (state.campaigns.some(({ id }) => id === campaign.id)) {
    throw new Error(`Campaign ${campaign.id} already exists.`);
  }
  state.campaigns.push(campaign);
  audit(state, {
    campaignId: campaign.id,
    actorType: "human",
    actorId: input.createdBy,
    action: "campaign_created",
    summary: `Created campaign: ${campaign.brief.slice(0, 160)}`,
    createdAt: timestamp
  });
  const run = createRunningRun(state, campaign, "research", now);
  return { state, campaign, run };
}

export function completeRun(
  current: MarketingWorkflowState,
  runId: string,
  output: string,
  now: Clock = () => new Date().toISOString(),
  options: { fallbackReason?: string } = {}
) {
  if (!output.trim()) throw new Error("Run output is required.");
  const state = cloneState(current);
  const run = requireRun(state, runId);
  if (run.status !== "running") {
    throw new Error(`Run ${run.id} must be running, current status is ${run.status}.`);
  }
  const campaign = requireCampaign(state, run.campaignId);
  if (campaign.activeRunId !== run.id) throw new Error(`Run ${run.id} is not active.`);
  const timestamp = now();
  run.output = output.trim();
  run.status = "pending_approval";
  run.fallbackReason = options.fallbackReason;
  run.updatedAt = timestamp;
  campaign.stage = pendingStages[run.stage];
  campaign.updatedAt = timestamp;
  audit(state, {
    campaignId: campaign.id,
    runId: run.id,
    actorType: "agent",
    actorId: run.role,
    action: "run_completed",
    summary: `${run.stage} package is pending human approval.`,
    createdAt: timestamp
  });
  if (options.fallbackReason) {
    audit(state, {
      campaignId: campaign.id,
      runId: run.id,
      actorType: "system",
      actorId: "ai-provider",
      action: "provider_fallback",
      summary: options.fallbackReason.slice(0, 240),
      createdAt: timestamp
    });
  }
  return { state, campaign, run };
}

export function approveRun(
  current: MarketingWorkflowState,
  runId: string,
  actorId: string,
  now: Clock = () => new Date().toISOString()
) {
  const existing = requireRun(current, runId);
  if (existing.status === "approved") {
    return { state: cloneState(current), run: { ...existing }, alreadyApplied: true as const };
  }
  if (existing.status !== "pending_approval") {
    throw new Error(`Run ${runId} must be pending_approval, current status is ${existing.status}.`);
  }

  const state = cloneState(current);
  const run = requireRun(state, runId);
  const campaign = requireCampaign(state, run.campaignId);
  if (campaign.activeRunId !== run.id) throw new Error(`Run ${run.id} is not active.`);
  const timestamp = now();
  run.status = "approved";
  run.updatedAt = timestamp;
  campaign.approvedRunIds.push(run.id);
  campaign.updatedAt = timestamp;
  audit(state, {
    campaignId: campaign.id,
    runId: run.id,
    actorType: "human",
    actorId,
    action: "run_approved",
    summary: `Approved ${run.stage} package.`,
    createdAt: timestamp
  });

  const nextStage = nextStages[run.stage];
  if (!nextStage) {
    campaign.stage = "ready_to_execute";
    campaign.activeRunId = undefined;
    audit(state, {
      campaignId: campaign.id,
      runId: run.id,
      actorType: "system",
      actorId: "marketing-manager",
      action: "campaign_ready",
      summary: "Campaign is human-approved and ready for manual execution.",
      createdAt: timestamp
    });
    return { state, campaign, run, alreadyApplied: false as const };
  }

  const nextRun = createRunningRun(state, campaign, nextStage, now);
  return { state, campaign, run, nextRun, alreadyApplied: false as const };
}

export function rejectRun(
  current: MarketingWorkflowState,
  runId: string,
  reason: string,
  actorId: string,
  now: Clock = () => new Date().toISOString()
) {
  if (!reason.trim()) throw new Error("A rejection reason is required.");
  const state = cloneState(current);
  const run = requireRun(state, runId);
  if (run.status !== "pending_approval") {
    throw new Error(`Run ${runId} must be pending_approval, current status is ${run.status}.`);
  }
  const campaign = requireCampaign(state, run.campaignId);
  const timestamp = now();
  run.status = "rejected";
  run.revisionFeedback = reason.trim();
  run.updatedAt = timestamp;
  campaign.stage = "rework_required";
  campaign.activeRunId = run.id;
  campaign.updatedAt = timestamp;
  audit(state, {
    campaignId: campaign.id,
    runId: run.id,
    actorType: "human",
    actorId,
    action: "run_rejected",
    summary: reason.trim().slice(0, 240),
    createdAt: timestamp
  });
  return { state, campaign, run };
}

export function reviseRun(
  current: MarketingWorkflowState,
  runId: string,
  feedback: string,
  actorId: string,
  now: Clock = () => new Date().toISOString()
) {
  if (!feedback.trim()) throw new Error("Revision feedback is required.");
  const state = cloneState(current);
  const parent = requireRun(state, runId);
  if (parent.status !== "rejected") {
    throw new Error(`Run ${runId} must be rejected before revision.`);
  }
  const campaign = requireCampaign(state, parent.campaignId);
  if (campaign.activeRunId !== parent.id) throw new Error(`Run ${runId} is not active.`);
  const timestamp = now();
  parent.status = "superseded";
  parent.updatedAt = timestamp;
  const run = createRunningRun(state, campaign, parent.stage, now, {
    parentRunId: parent.id,
    revisionFeedback: feedback.trim()
  });
  audit(state, {
    campaignId: campaign.id,
    runId: run.id,
    actorType: "human",
    actorId,
    action: "revision_started",
    summary: feedback.trim().slice(0, 240),
    createdAt: timestamp
  });
  return { state, campaign, run };
}

export function buildStageInput(state: MarketingWorkflowState, runId: string) {
  const run = requireRun(state, runId);
  const campaign = requireCampaign(state, run.campaignId);
  const approvedOutputs = campaign.approvedRunIds
    .map((approvedId) => state.runs.find(({ id }) => id === approvedId))
    .filter((item): item is MarketingAgentRunRuntime => Boolean(item))
    .map((item) => `${item.stage.toUpperCase()} PACKAGE\n${item.output}`);
  const revision = run.revisionFeedback
    ? `\n\nREVISION FEEDBACK\n${run.revisionFeedback}`
    : "";
  return [`CAMPAIGN ${campaign.id}`, `BRIEF\n${campaign.brief}`, ...approvedOutputs]
    .join("\n\n")
    .concat(revision)
    .slice(0, 10000);
}

export function listPendingRuns(state: MarketingWorkflowState) {
  return state.runs.filter(({ status }) => status === "pending_approval");
}

export function getCampaignTimeline(state: MarketingWorkflowState, campaignIdValue: string) {
  requireCampaign(state, campaignIdValue);
  return state.auditEvents.filter(({ campaignId }) => campaignId === campaignIdValue);
}

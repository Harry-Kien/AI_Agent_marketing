import { describe, expect, it } from "vitest";
import {
  approveRun,
  buildStageInput,
  completeRun,
  createCampaign,
  createEmptyWorkflowState,
  requestPublicationConfirmation,
  confirmPublication,
  completePublication,
  failPublication,
  listPendingRuns,
  rejectRun,
  reviseRun
} from "../src/integrations/marketingWorkflow";

const clock = (() => {
  let tick = 0;
  return () => new Date(Date.UTC(2026, 6, 14, 12, 0, tick++)).toISOString();
})();

describe("enterprise marketing workflow", () => {
  it("creates a campaign with only the research department running", () => {
    const result = createCampaign(createEmptyWorkflowState(), {
      brief: "Ra mat dich vu AI Agent cho SME",
      createdBy: "6590103144",
      now: clock,
      idSuffix: "A1B2"
    });

    expect(result.campaign.id).toBe("CMP-20260714-A1B2");
    expect(result.campaign.stage).toBe("research_running");
    expect(result.run.stage).toBe("research");
    expect(result.run.status).toBe("running");
    expect(result.state.runs).toHaveLength(1);
  });

  it("moves through all five approval gates without skipping departments", () => {
    let state = createCampaign(createEmptyWorkflowState(), {
      brief: "Ra mat dich vu AI Agent cho SME",
      createdBy: "owner",
      now: clock,
      idSuffix: "FLOW"
    }).state;

    const research = state.runs[0];
    state = completeRun(state, research.id, "Research package", clock).state;
    expect(state.campaigns[0].stage).toBe("research_pending_approval");
    expect(listPendingRuns(state).map((run) => run.id)).toEqual([research.id]);

    let approval = approveRun(state, research.id, "owner", clock);
    state = approval.state;
    expect(approval.nextRun?.stage).toBe("content");
    expect(state.campaigns[0].stage).toBe("content_running");
    expect(buildStageInput(state, approval.nextRun!.id)).toContain("Research package");

    const content = approval.nextRun!;
    state = completeRun(state, content.id, "Content package", clock).state;
    approval = approveRun(state, content.id, "owner", clock);
    state = approval.state;
    expect(approval.nextRun?.stage).toBe("creative");
    expect(buildStageInput(state, approval.nextRun!.id)).toContain("Content package");

    const creative = approval.nextRun!;
    state = completeRun(state, creative.id, "Creative package", clock).state;
    approval = approveRun(state, creative.id, "owner", clock);
    state = approval.state;
    expect(approval.nextRun?.stage).toBe("brand");
    expect(buildStageInput(state, approval.nextRun!.id)).toContain("Creative package");

    const brand = approval.nextRun!;
    state = completeRun(state, brand.id, "Brand and KPI review", clock).state;
    approval = approveRun(state, brand.id, "owner", clock);
    state = approval.state;
    expect(approval.nextRun?.stage).toBe("final");
    expect(buildStageInput(state, approval.nextRun!.id)).toContain("Brand and KPI review");

    const finalRun = approval.nextRun!;
    state = completeRun(state, finalRun.id, "Final campaign package", clock).state;
    approval = approveRun(state, finalRun.id, "owner", clock);

    expect(approval.nextRun).toBeUndefined();
    expect(approval.state.campaigns[0].stage).toBe("ready_to_schedule");
    expect(approval.state.campaigns[0].approvedRunIds).toHaveLength(5);
  });

  it("requires a rejection reason and starts a traceable revision", () => {
    const created = createCampaign(createEmptyWorkflowState(), {
      brief: "Campaign B2B",
      createdBy: "owner",
      now: clock,
      idSuffix: "RWRK"
    });
    const completed = completeRun(
      created.state,
      created.run.id,
      "Research draft",
      clock
    );

    expect(() => rejectRun(completed.state, created.run.id, "", "owner", clock)).toThrow(
      /reason/i
    );

    const rejected = rejectRun(
      completed.state,
      created.run.id,
      "Can them bang chung doi thu",
      "owner",
      clock
    );
    expect(rejected.state.campaigns[0].stage).toBe("rework_required");
    expect(rejected.run.status).toBe("rejected");
    expect(rejected.run.revisionFeedback).toContain("bang chung");

    const revision = reviseRun(
      rejected.state,
      rejected.run.id,
      "Bo sung 3 doi thu truc tiep",
      "owner",
      clock
    );
    expect(revision.run.parentRunId).toBe(rejected.run.id);
    expect(revision.run.stage).toBe("research");
    expect(revision.run.status).toBe("running");
    expect(revision.state.runs).toHaveLength(2);
  });

  it("is idempotent when the same approval is submitted twice", () => {
    const created = createCampaign(createEmptyWorkflowState(), {
      brief: "Campaign idempotent",
      createdBy: "owner",
      now: clock,
      idSuffix: "IDEM"
    });
    const completed = completeRun(created.state, created.run.id, "Research", clock);
    const first = approveRun(completed.state, created.run.id, "owner", clock);
    const second = approveRun(first.state, created.run.id, "owner", clock);

    expect(first.nextRun?.stage).toBe("content");
    expect(second.nextRun).toBeUndefined();
    expect(second.alreadyApplied).toBe(true);
    expect(second.state.runs).toHaveLength(2);
  });

  it("records policy-engine approvals as system audit events", () => {
    const created = createCampaign(createEmptyWorkflowState(), {
      brief: "Campaign auto handoff",
      createdBy: "owner",
      now: clock,
      idSuffix: "AUTO"
    });
    const completed = completeRun(created.state, created.run.id, "Research package", clock);
    const approved = approveRun(completed.state, created.run.id, "policy-engine", clock, {
      actorType: "system",
      auditAction: "run_auto_approved"
    });
    const event = approved.state.auditEvents.find(({ action }) => action === "run_auto_approved");

    expect(event).toMatchObject({ actorType: "system", actorId: "policy-engine" });
    expect(approved.nextRun?.stage).toBe("content");
  });

  it("does not allow incomplete or out-of-order runs to be approved", () => {
    const created = createCampaign(createEmptyWorkflowState(), {
      brief: "Campaign guarded",
      createdBy: "owner",
      now: clock,
      idSuffix: "GUARD"
    });

    expect(() => approveRun(created.state, created.run.id, "owner", clock)).toThrow(
      /pending_approval/
    );
  });

  it("requires two-step publication confirmation and stores external evidence", () => {
    let state = createCampaign(createEmptyWorkflowState(), {
      brief: "Campaign publication guard",
      createdBy: "owner",
      now: clock,
      idSuffix: "PUB"
    }).state;
    for (const stage of ["research", "content", "creative", "brand", "final"] as const) {
      const run = state.runs.find((item) => item.status === "running" && item.stage === stage)!;
      state = completeRun(
        state,
        run.id,
        `${stage} package`,
        clock,
        stage === "final"
          ? { publicationContent: "Bai Facebook cuoi cung da qua kiem dinh.\n\nDang ky tu van ngay." }
          : {}
      ).state;
      state = approveRun(state, run.id, "owner", clock).state;
    }

    const preview = requestPublicationConfirmation(state, state.campaigns[0].id, "owner", clock);
    expect(preview.campaign.stage).toBe("publication_pending_confirmation");
    expect(preview.campaign.publicationPreview).toBe(
      "Bản xem trước xuất bản:\nBai Facebook cuoi cung da qua kiem dinh.\n\nDang ky tu van ngay."
    );
    expect(preview.campaign.publicationPreview).not.toContain("Campaign publication guard");

    const confirmed = confirmPublication(preview.state, preview.campaign.id, "owner", clock);
    expect(confirmed.campaign.stage).toBe("publishing");

    const published = completePublication(
      confirmed.state,
      confirmed.campaign.id,
      { postId: "page_123", permalink: "https://facebook.test/page_123" },
      clock
    );
    expect(published.campaign.stage).toBe("published");
    expect(published.campaign.publicationEvidence?.postId).toBe("page_123");
  });

  it("stops safely and records an audit event when Meta publication fails", () => {
    let state = createCampaign(createEmptyWorkflowState(), {
      brief: "Campaign Meta failure",
      createdBy: "owner",
      now: clock,
      idSuffix: "FAILPUB"
    }).state;
    for (const stage of ["research", "content", "creative", "brand", "final"] as const) {
      const run = state.runs.find((item) => item.status === "running" && item.stage === stage)!;
      state = completeRun(state, run.id, `${stage} package`, clock, {
        publicationContent: stage === "final" ? "Bai Facebook da duoc duyet va san sang dang." : undefined
      }).state;
      state = approveRun(state, run.id, "owner", clock).state;
    }
    state = requestPublicationConfirmation(state, state.campaigns[0].id, "owner", clock).state;
    state = confirmPublication(state, state.campaigns[0].id, "owner", clock).state;

    const failed = failPublication(state, state.campaigns[0].id, "Meta Graph HTTP 500", clock);

    expect(failed.campaign.stage).toBe("failed");
    expect(failed.state.auditEvents[failed.state.auditEvents.length - 1]).toMatchObject({
      action: "publication_failed",
      actorId: "meta-graph"
    });
  });
});

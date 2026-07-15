import { describe, expect, it } from "vitest";
import { generateMarketingAgentOutput } from "../src/integrations/aiProvider";
import { resolveManagerIntent } from "../src/integrations/managerIntent";
import {
  approveRun,
  completePublication,
  completeRun,
  confirmPublication,
  createCampaign,
  createEmptyWorkflowState,
  rejectRun,
  requestPublicationConfirmation,
  reviseRun
} from "../src/integrations/marketingWorkflow";

describe("golden enterprise marketing sequence", () => {
  it("runs natural-language intake through five gates, rework and publication evidence", async () => {
    const intent = await resolveManagerIntent(
      "Hãy tạo chiến dịch giới thiệu AI Agent cho doanh nghiệp SME trên Facebook",
      { pendingRunIds: [] }
    );
    expect(intent.intent).toBe("create_campaign");

    let state = createCampaign(createEmptyWorkflowState(), {
      brief: intent.brief ?? "AI Agent SME",
      createdBy: "operator",
      idSuffix: "GOLD"
    }).state;
    const observedRoles: string[] = [];

    for (const stage of ["research", "content", "creative", "brand", "final"] as const) {
      let run = state.runs.find((item) => item.status === "running" && item.stage === stage)!;
      observedRoles.push(run.role);
      const output = await generateMarketingAgentOutput(
        { enabled: false, baseUrl: "local", apiKey: "", model: "mock" },
        { role: run.role, command: stage, topic: state.campaigns[0].brief, context: run.input }
      );
      state = completeRun(state, run.id, output.text).state;

      if (stage === "content") {
        state = rejectRun(state, run.id, "CTA chưa gắn với lịch tư vấn", "operator").state;
        const revision = reviseRun(state, run.id, "Dùng một CTA đặt lịch duy nhất", "operator");
        state = revision.state;
        run = revision.run;
        const revised = await generateMarketingAgentOutput(
          { enabled: false, baseUrl: "local", apiKey: "", model: "mock" },
          { role: run.role, command: stage, topic: state.campaigns[0].brief, context: run.input }
        );
        state = completeRun(state, run.id, revised.text).state;
      }
      state = approveRun(state, run.id, "operator").state;
    }

    expect(observedRoles).toEqual(["market-radar", "content-creator", "creative-production", "performance-brand", "manager"]);
    expect(state.campaigns[0].stage).toBe("ready_to_schedule");
    expect(state.runs.some((run) => run.status === "superseded")).toBe(true);

    state = requestPublicationConfirmation(state, state.campaigns[0].id, "operator").state;
    expect(state.campaigns[0].stage).toBe("publication_pending_confirmation");
    state = confirmPublication(state, state.campaigns[0].id, "operator").state;
    state = completePublication(state, state.campaigns[0].id, { postId: "page_post_demo" }).state;
    expect(state.campaigns[0].stage).toBe("published");
    expect(state.campaigns[0].publicationEvidence?.postId).toBe("page_post_demo");
    expect(state.auditEvents.length).toBeGreaterThan(20);
  });
});

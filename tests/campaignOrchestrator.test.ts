// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createEmptyWorkflowState } from "../src/integrations/marketingWorkflow";
import {
  approveActive,
  confirmPublicationFlow,
  findActivePendingRun,
  rejectActive,
  requestPublication,
  startCampaign,
  type OrchestratorContext
} from "../src/integrations/campaignOrchestrator";

const fixedNow = () => "2026-07-22T10:00:00.000Z";
const ctx: OrchestratorContext = {
  ai: { enabled: false, baseUrl: "local", apiKey: "", model: "mock" },
  policy: { mode: "strict-stage-gate", autoApproveScore: 80, conditionalHandoffScore: 70, maxAutoRevisions: 1 },
  now: fixedNow
};

describe("campaign orchestrator (không Telegram)", () => {
  it("mở chiến dịch và dừng tại cổng người duyệt đầu tiên", async () => {
    const state = await startCampaign(createEmptyWorkflowState(), ctx, {
      brief: "Chiến dịch AI cho SME",
      createdBy: "operator",
      idSuffix: "T1"
    });
    expect(state.campaigns).toHaveLength(1);
    expect(findActivePendingRun(state)?.stage).toBe("research");
  });

  it("duyệt tuần tự 5 cổng rồi xác nhận xuất bản (guarded mock)", async () => {
    let state = await startCampaign(createEmptyWorkflowState(), ctx, {
      brief: "Chiến dịch AI cho SME",
      createdBy: "operator",
      idSuffix: "T2"
    });
    for (const stage of ["research", "content", "creative", "brand"] as const) {
      expect(findActivePendingRun(state)?.stage).toBe(stage);
      state = await approveActive(state, ctx, "operator");
    }
    expect(findActivePendingRun(state)?.stage).toBe("final");
    state = await approveActive(state, ctx, "operator");
    expect(state.campaigns[0].stage).toBe("publication_pending_confirmation");

    state = await confirmPublicationFlow(state, { actorId: "operator", now: fixedNow });
    expect(state.campaigns[0].stage).toBe("published");
    expect(state.campaigns[0].publicationEvidence?.postId).toContain("MOCK");
  });

  it("dùng publisher thật khi được truyền vào (Meta bật)", async () => {
    let state = await startCampaign(createEmptyWorkflowState(), ctx, { brief: "AI SME", createdBy: "op", idSuffix: "T3" });
    for (let i = 0; i < 5; i += 1) state = await approveActive(state, ctx, "op");
    state = await confirmPublicationFlow(state, {
      actorId: "op",
      publisher: async () => ({ postId: "page_123", permalink: "https://fb.com/p/123" }),
      now: fixedNow
    });
    expect(state.campaigns[0].publicationEvidence?.postId).toBe("page_123");
  });

  it("từ chối tạo bản sửa và chạy lại cùng stage", async () => {
    let state = await startCampaign(createEmptyWorkflowState(), ctx, { brief: "AI SME", createdBy: "op", idSuffix: "T4" });
    state = await rejectActive(state, ctx, { feedback: "CTA chưa rõ", actorId: "op" });
    expect(findActivePendingRun(state)?.stage).toBe("research");
    expect(state.runs.some((run) => run.status === "superseded")).toBe(true);
  });

  it("requestPublication không đổi trạng thái khi chưa ready_to_schedule", () => {
    const state = createEmptyWorkflowState();
    expect(requestPublication(state, "op", fixedNow)).toBe(state);
  });
});

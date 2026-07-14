import { describe, expect, it } from "vitest";
import { resolveManagerIntent } from "../src/integrations/managerIntent";

describe("Vietnamese manager intent router", () => {
  it("understands campaign creation, status and approval queue", async () => {
    expect((await resolveManagerIntent("Hãy tạo chiến dịch ứng dụng AI cho SME", { pendingRunIds: [] })).intent).toBe("create_campaign");
    expect((await resolveManagerIntent("Tình hình chiến dịch CMP-01 thế nào?", { pendingRunIds: [] })).intent).toBe("status");
    expect((await resolveManagerIntent("Có gì đang chờ tôi duyệt?", { pendingRunIds: [] })).intent).toBe("approvals");
  });

  it("resolves short approval only when exactly one result is pending", async () => {
    const safe = await resolveManagerIntent("Duyệt", { pendingRunIds: ["RUN-01"] });
    expect(safe).toMatchObject({ intent: "approve", runId: "RUN-01" });

    expect((await resolveManagerIntent("Duyệt", { pendingRunIds: [] })).intent).toBe("unclear");
    expect((await resolveManagerIntent("Duyệt", { pendingRunIds: ["RUN-01", "RUN-02"] })).intent).toBe("unclear");
  });

  it("extracts rejection and revision feedback", async () => {
    const rejected = await resolveManagerIntent("Không duyệt vì CTA còn chung chung", { pendingRunIds: ["RUN-02"] });
    expect(rejected).toMatchObject({ intent: "reject", runId: "RUN-02" });
    expect(rejected.reason).toContain("CTA");

    const revised = await resolveManagerIntent("Sửa lại theo hướng có ví dụ thực tế", { rejectedRunIds: ["RUN-03"], pendingRunIds: [] });
    expect(revised).toMatchObject({ intent: "revise", runId: "RUN-03" });
  });

  it("asks for clarification below the safe confidence threshold", async () => {
    const result = await resolveManagerIntent("làm tiếp đi", { pendingRunIds: [] });
    expect(result.intent).toBe("unclear");
    expect(result.confidence).toBeLessThan(0.82);
    expect(result.clarification).toBeTruthy();
  });
});

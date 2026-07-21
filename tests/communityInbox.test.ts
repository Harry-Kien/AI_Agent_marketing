// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseCommunityMessage } from "../src/domain/communityTypes";
import {
  buildCommunityReadModel,
  classifyCommunityMessage,
  redactPii,
  sampleApprovedFaqs,
  sampleCommunityMessages,
  triageInbox,
  triageMessage
} from "../src/integrations/communityInbox";

const fixedNow = () => "2026-07-21T10:15:00.000Z";

describe("classifyCommunityMessage", () => {
  it("nhận diện lead, khiếu nại, faq và spam", () => {
    const [lead, complaint, faq, spam] = sampleCommunityMessages;
    expect(classifyCommunityMessage(lead).category).toBe("lead");
    expect(classifyCommunityMessage(complaint).category).toBe("complaint");
    expect(classifyCommunityMessage(faq).category).toBe("faq");
    expect(classifyCommunityMessage(spam).category).toBe("spam");
  });

  it("lead có ý định mạnh được lead score cao", () => {
    expect(classifyCommunityMessage(sampleCommunityMessages[0]).leadScore).toBeGreaterThanOrEqual(75);
  });
});

describe("redactPii", () => {
  it("che số điện thoại và email", () => {
    const redacted = redactPii("Liên hệ 0901234567 hoặc a.b@mail.com nhé");
    expect(redacted).not.toContain("0901234567");
    expect(redacted).not.toContain("a.b@mail.com");
    expect(redacted).toContain("đã ẩn");
  });
});

describe("triageMessage", () => {
  it("khiếu nại -> escalate ưu tiên cao", () => {
    const triaged = triageMessage(sampleCommunityMessages[1], { faqs: sampleApprovedFaqs, now: fixedNow });
    expect(triaged.category).toBe("complaint");
    expect(triaged.priority).toBe("high");
    expect(triaged.action).toBe("escalate");
  });

  it("faq khớp -> draft khi auto-reply tắt", () => {
    const triaged = triageMessage(sampleCommunityMessages[2], { faqs: sampleApprovedFaqs, autoReplyEnabled: false });
    expect(triaged.action).toBe("draft_for_approval");
    expect(triaged.suggestedReply).toContain("triển khai");
  });

  it("spam -> không tự trả lời", () => {
    const triaged = triageMessage(sampleCommunityMessages[3], { faqs: sampleApprovedFaqs });
    expect(triaged.category).toBe("spam");
    expect(triaged.priority).toBe("ignore");
    expect(triaged.suggestedReply).toBeUndefined();
  });

  it("text hiển thị đã được che PII", () => {
    const triaged = triageMessage(sampleCommunityMessages[0], { faqs: sampleApprovedFaqs });
    expect(triaged.redactedText).not.toContain("0901234567");
  });
});

describe("read model", () => {
  it("tổng hợp theo loại, đếm escalation, sắp xếp ưu tiên", () => {
    const model = buildCommunityReadModel(sampleCommunityMessages, {
      faqs: sampleApprovedFaqs,
      now: fixedNow
    });
    expect(model.totals.lead).toBe(1);
    expect(model.totals.complaint).toBe(1);
    expect(model.totals.spam).toBe(1);
    expect(model.escalations).toBeGreaterThan(0);
    expect(model.messages[0].priority).toBe("high");
    const serialized = JSON.stringify(model);
    expect(serialized).not.toContain("0901234567");
  });
});

describe("parse", () => {
  it("từ chối tin sai schema (failure path)", () => {
    expect(parseCommunityMessage({ id: "x" }).success).toBe(false);
    expect(parseCommunityMessage(sampleCommunityMessages[0]).success).toBe(true);
  });
});

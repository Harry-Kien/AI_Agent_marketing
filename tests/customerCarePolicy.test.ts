import { describe, expect, it } from "vitest";
import { decideCustomerCareAction } from "../src/integrations/customerCarePolicy";

const faq = [{ id: "faq-1", question: "Giờ làm việc", answer: "Chúng tôi phản hồi từ 8h đến 18h.", keywords: ["giờ làm việc", "mấy giờ"] }];

describe("customer care policy", () => {
  it("uses only approved FAQ and respects the auto-reply switch", () => {
    expect(decideCustomerCareAction({ text: "Bên bạn làm việc mấy giờ?", autoReplyEnabled: true }, faq).action).toBe("auto_reply");
    expect(decideCustomerCareAction({ text: "Bên bạn làm việc mấy giờ?", autoReplyEnabled: false }, faq).action).toBe("draft_for_approval");
  });
  it("escalates pricing, complaints, personal data and unclear messages", () => {
    for (const text of ["Giá bao nhiêu?", "Tôi muốn khiếu nại", "CCCD của tôi là 123", "tư vấn giúp"]) {
      expect(decideCustomerCareAction({ text, autoReplyEnabled: true }, faq).action).toBe("escalate");
    }
  });
});

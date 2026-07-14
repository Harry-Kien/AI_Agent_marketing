export interface ApprovedFaq { id: string; question: string; answer: string; keywords: string[] }
export interface CustomerInteraction { text: string; autoReplyEnabled: boolean }
export interface CustomerCareDecision {
  action: "auto_reply" | "draft_for_approval" | "escalate";
  reason: string;
  reply?: string;
  faqId?: string;
}

const sensitivePattern = /(giá|bao nhiêu tiền|báo giá|khiếu nại|phàn nàn|hoàn tiền|cccd|căn cước|số điện thoại|email|mật khẩu|pháp lý|bảo mật)/i;

export function decideCustomerCareAction(interaction: CustomerInteraction, knowledgeBase: ApprovedFaq[]): CustomerCareDecision {
  const text = interaction.text.trim();
  if (sensitivePattern.test(text)) return { action: "escalate", reason: "Nội dung nhạy cảm cần người quản lý xử lý." };
  const faq = knowledgeBase.find((item) => item.keywords.some((keyword) => text.toLocaleLowerCase("vi").includes(keyword.toLocaleLowerCase("vi"))));
  if (!faq) return { action: "escalate", reason: "Không có câu trả lời đã được duyệt phù hợp." };
  return {
    action: interaction.autoReplyEnabled ? "auto_reply" : "draft_for_approval",
    reason: interaction.autoReplyEnabled ? "Khớp FAQ đã duyệt." : "Auto-reply đang tắt; cần duyệt bản nháp.",
    reply: faq.answer,
    faqId: faq.id
  };
}

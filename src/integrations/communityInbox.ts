import {
  communityCategories,
  type CommunityCategory,
  type CommunityMessage,
  type CommunityPriority,
  type CommunityReadModel,
  type TriagedMessage
} from "../domain/communityTypes";
import { decideCustomerCareAction, type ApprovedFaq } from "./customerCarePolicy";

const nowIso = () => new Date().toISOString();

const complaintPattern = /(khiếu nại|phàn nàn|hoàn tiền|thất vọng|quá tệ|lừa đảo|tệ hại|bức xúc)/i;
const leadPattern = /(tư vấn|báo giá|bảng giá|đăng ký|mua|quan tâm|liên hệ|cần|dùng thử|demo|hợp tác)/i;
const spamPattern = /(https?:\/\/|kiếm tiền|vay nhanh|sub \d|seeding|kèo|nổ hũ|traffic giá rẻ)/i;

// Che số điện thoại và email trước khi hiển thị/log (quy tắc bảo mật: không lộ dữ liệu cá nhân).
export function redactPii(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email đã ẩn]")
    .replace(/(?:\+?84|0)(?:[\s.-]?\d){8,10}/g, "[số điện thoại đã ẩn]");
}

export function classifyCommunityMessage(message: CommunityMessage): {
  category: CommunityCategory;
  leadScore: number;
} {
  const text = message.text.toLocaleLowerCase("vi");
  if (spamPattern.test(message.text)) return { category: "spam", leadScore: 0 };
  if (complaintPattern.test(text)) return { category: "complaint", leadScore: 0 };

  let leadScore = 0;
  if (leadPattern.test(text)) leadScore += 55;
  if (/(báo giá|bảng giá|giá|chi phí)/i.test(text)) leadScore += 20;
  if (/(số lượng|ngân sách|team|doanh nghiệp|công ty)/i.test(text)) leadScore += 15;
  if (/[?]/.test(message.text)) leadScore += 5;
  leadScore = Math.min(leadScore, 100);

  if (leadScore >= 55) return { category: "lead", leadScore };
  if (/[?]/.test(message.text)) return { category: "faq", leadScore };
  return { category: "general", leadScore };
}

function priorityOf(category: CommunityCategory, leadScore: number): CommunityPriority {
  if (category === "spam") return "ignore";
  if (category === "complaint") return "high";
  if (category === "lead") return leadScore >= 75 ? "high" : "medium";
  if (category === "faq") return "medium";
  return "low";
}

export interface TriageOptions {
  faqs?: ApprovedFaq[];
  autoReplyEnabled?: boolean;
  now?: () => string;
}

export function triageMessage(message: CommunityMessage, options: TriageOptions = {}): TriagedMessage {
  const { category, leadScore } = classifyCommunityMessage(message);
  const priority = priorityOf(category, leadScore);

  // Tái dùng policy CSKH cho quyết định phản hồi; spam thì bỏ qua, không escalate.
  let action: TriagedMessage["action"] = "escalate";
  let reason = "Cần người quản lý xử lý.";
  let suggestedReply: string | undefined;

  if (category === "spam") {
    action = "escalate";
    reason = "Nghi ngờ spam; ẩn/bỏ qua, không tự trả lời.";
  } else {
    const decision = decideCustomerCareAction(
      { text: message.text, autoReplyEnabled: options.autoReplyEnabled ?? false },
      options.faqs ?? []
    );
    action = decision.action;
    reason = decision.reason;
    suggestedReply = decision.reply;
  }

  return {
    id: message.id,
    channel: message.channel,
    category,
    priority,
    leadScore,
    action,
    reason,
    suggestedReply,
    redactedText: redactPii(message.text),
    createdAt: message.createdAt
  };
}

const priorityRank: Record<CommunityPriority, number> = { high: 0, medium: 1, low: 2, ignore: 3 };

export function triageInbox(messages: CommunityMessage[], options: TriageOptions = {}): TriagedMessage[] {
  return messages
    .map((message) => triageMessage(message, options))
    .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || b.leadScore - a.leadScore);
}

export function buildCommunityReadModel(
  messages: CommunityMessage[],
  options: TriageOptions & { connected?: boolean } = {}
): CommunityReadModel {
  const now = options.now ?? nowIso;
  const triaged = triageInbox(messages, options);
  const totals = Object.fromEntries(communityCategories.map((category) => [category, 0])) as Record<
    CommunityCategory,
    number
  >;
  for (const message of triaged) totals[message.category] += 1;
  return {
    connected: options.connected ?? true,
    generatedAt: now(),
    totals,
    escalations: triaged.filter((message) => message.action === "escalate").length,
    messages: triaged
  };
}

// Fixture mẫu cho endpoint demo và test.
export const sampleApprovedFaqs: ApprovedFaq[] = [
  {
    id: "faq-onboarding",
    question: "Triển khai mất bao lâu?",
    answer: "Thời gian triển khai trung bình 3-5 ngày làm việc, có người đồng hành từng bước.",
    keywords: ["triển khai", "bao lâu", "thời gian", "setup"]
  }
];

export const sampleCommunityMessages: CommunityMessage[] = [
  {
    id: "msg-1",
    channel: "comment",
    author: "Chủ shop A",
    text: "Bên mình cần tư vấn báo giá gói AI Agent cho công ty 20 người, liên hệ 0901234567 nhé.",
    createdAt: "2026-07-21T09:30:00.000Z"
  },
  {
    id: "msg-2",
    channel: "inbox",
    author: "Khách B",
    text: "Dịch vụ quá tệ, tôi muốn khiếu nại và hoàn tiền ngay.",
    createdAt: "2026-07-21T09:35:00.000Z"
  },
  {
    id: "msg-3",
    channel: "comment",
    author: "Người dùng C",
    text: "Triển khai mất bao lâu vậy shop?",
    createdAt: "2026-07-21T09:40:00.000Z"
  },
  {
    id: "msg-4",
    channel: "comment",
    author: "Spammer",
    text: "Kiếm tiền online 10tr/ngày, inbox ngay https://spam.example",
    createdAt: "2026-07-21T09:45:00.000Z"
  }
];

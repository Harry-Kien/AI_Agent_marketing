import { z } from "zod";

// Phân loại tương tác cộng đồng (F10).
export const communityCategories = ["lead", "faq", "complaint", "spam", "general"] as const;
export type CommunityCategory = (typeof communityCategories)[number];

export const communityChannels = ["comment", "inbox"] as const;
export type CommunityChannel = (typeof communityChannels)[number];

export type CommunityPriority = "high" | "medium" | "low" | "ignore";

// Tin nhắn/bình luận thô đến từ Page.
export const communityMessageSchema = z.strictObject({
  id: z.string().trim().min(1).max(80),
  channel: z.enum(communityChannels),
  author: z.string().trim().min(1).max(120),
  text: z.string().trim().min(1).max(2000),
  createdAt: z.string().trim().min(1).max(40) // ISO 8601
});
export type CommunityMessage = z.infer<typeof communityMessageSchema>;

// Tin đã phân loại + đề xuất xử lý.
export interface TriagedMessage {
  id: string;
  channel: CommunityChannel;
  category: CommunityCategory;
  priority: CommunityPriority;
  leadScore: number; // 0..100
  action: "auto_reply" | "draft_for_approval" | "escalate";
  reason: string;
  suggestedReply?: string;
  redactedText: string; // đã che số điện thoại/email
  createdAt: string;
}

// Read model đã redacted cho Community & Lead Center (B08).
export interface CommunityReadModel {
  connected: boolean;
  generatedAt: string;
  totals: Record<CommunityCategory, number>;
  escalations: number;
  messages: TriagedMessage[];
}

export function parseCommunityMessage(value: unknown) {
  return communityMessageSchema.safeParse(value);
}

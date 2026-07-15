export type ManagerIntent =
  | "create_campaign"
  | "status"
  | "approvals"
  | "approve"
  | "reject"
  | "revise"
  | "schedule"
  | "confirm_publish"
  | "community_inbox"
  | "help"
  | "unclear";

export interface ManagerConversationContext {
  pendingRunIds: string[];
  approvedFinalRunIdsReadyToSchedule?: string[];
  rejectedRunIds?: string[];
  campaignIds?: string[];
}

export interface IntentDecision {
  intent: ManagerIntent;
  confidence: number;
  campaignId?: string;
  runId?: string;
  reason?: string;
  brief?: string;
  clarification?: string;
}

const idPattern = /\b(?:RUN|CMP)-[A-Z0-9-]+\b/i;

function normalize(text: string) {
  return text.trim().replace(/\s+/g, " ");
}

function pickId(text: string, prefix: "RUN" | "CMP") {
  const match = text.match(idPattern)?.[0]?.toUpperCase();
  return match?.startsWith(prefix) ? match : undefined;
}

function singleOrClarify(ids: string[], action: ManagerIntent): IntentDecision {
  if (ids.length === 1) return { intent: action, confidence: 0.98, runId: ids[0] };
  return {
    intent: "unclear",
    confidence: 0.45,
    clarification: ids.length === 0
      ? "Hiện không có kết quả phù hợp để xử lý. Bạn có thể hỏi 'đang chờ duyệt gì?'."
      : `Có ${ids.length} kết quả phù hợp. Hãy ghi rõ mã RUN cần xử lý.`
  };
}

export async function resolveManagerIntent(
  rawText: string,
  context: ManagerConversationContext
): Promise<IntentDecision> {
  const text = normalize(rawText);
  const lower = text.toLocaleLowerCase("vi");
  const explicitRun = pickId(text, "RUN");
  const explicitCampaign = pickId(text, "CMP");

  if (/^(duyệt|đồng ý|ok|approve)(\s|$)/i.test(lower)) {
    const candidates = context.pendingRunIds.length
      ? context.pendingRunIds
      : context.approvedFinalRunIdsReadyToSchedule ?? [];
    return explicitRun ? { intent: "approve", confidence: 0.99, runId: explicitRun } : singleOrClarify(candidates, "approve");
  }
  if (/^(không duyệt|từ chối|reject)(\s|$)/i.test(lower)) {
    const target = explicitRun ? { intent: "reject" as const, confidence: 0.99, runId: explicitRun } : singleOrClarify(context.pendingRunIds, "reject");
    if (target.intent === "unclear") return target;
    const reason = text.replace(/^(không duyệt|từ chối|reject)\s*(?:RUN-[A-Z0-9-]+)?\s*(?:vì|do|:)?\s*/i, "").trim();
    return reason ? { ...target, reason } : { intent: "unclear", confidence: 0.6, clarification: "Hãy cho biết lý do không duyệt để Agent sửa đúng." };
  }
  if (/^(sửa lại|làm lại|revise)(\s|$)/i.test(lower)) {
    const target = explicitRun ? { intent: "revise" as const, confidence: 0.99, runId: explicitRun } : singleOrClarify(context.rejectedRunIds ?? [], "revise");
    if (target.intent === "unclear") return target;
    const reason = text.replace(/^(sửa lại|làm lại|revise)\s*(?:RUN-[A-Z0-9-]+)?\s*(?:theo|:)?\s*/i, "").trim();
    return reason ? { ...target, reason } : { intent: "unclear", confidence: 0.6, clarification: "Hãy nói rõ nội dung cần sửa." };
  }
  if (/(chờ.*duyệt|cần.*duyệt|approval)/i.test(lower)) return { intent: "approvals", confidence: 0.96 };
  if (/(tình hình|trạng thái|tiến độ|status)/i.test(lower)) return { intent: "status", confidence: 0.92, campaignId: explicitCampaign };
  if (/(tạo|lập|khởi tạo).*(chiến dịch|campaign)/i.test(lower) || /(marketing|quảng bá|ra mắt).*(cho|về)/i.test(lower)) {
    const brief = text.replace(/^.*?(?:chiến dịch|campaign)\s*/i, "").trim() || text;
    return { intent: "create_campaign", confidence: 0.94, brief };
  }
  if (/(hộp thư|inbox|bình luận|tin nhắn khách hàng|chăm sóc khách hàng|phản hồi khách hàng)/i.test(lower)) {
    return { intent: "community_inbox", confidence: 0.9 };
  }
  if (/(xác nhận đăng|đăng ngay|confirm publish)/i.test(lower)) return { intent: "confirm_publish", confidence: 0.94, campaignId: explicitCampaign };
  if (/(lên lịch|chuẩn bị đăng|schedule)/i.test(lower)) return { intent: "schedule", confidence: 0.91, campaignId: explicitCampaign };
  if (/^(help|trợ giúp|hướng dẫn)$/i.test(lower)) return { intent: "help", confidence: 0.99 };
  return {
    intent: "unclear",
    confidence: 0.4,
    clarification: "Tôi chưa chắc bạn muốn tạo chiến dịch, xem tiến độ hay phê duyệt. Hãy nói rõ mục tiêu hoặc mã chiến dịch."
  };
}

export function intentToFallbackCommand(decision: IntentDecision) {
  switch (decision.intent) {
    case "create_campaign": return `/campaign ${decision.brief ?? ""}`.trim();
    case "status": return decision.campaignId ? `/status ${decision.campaignId}` : "/campaigns";
    case "approvals": return "/approvals";
    case "approve": return `/approve ${decision.runId}`;
    case "reject": return `/reject ${decision.runId} ${decision.reason ?? ""}`.trim();
    case "revise": return `/revise ${decision.runId} ${decision.reason ?? ""}`.trim();
    case "community_inbox": return "/community";
    case "schedule": return decision.campaignId ? `/schedule ${decision.campaignId}` : "/schedule";
    case "confirm_publish": return decision.campaignId ? `/confirm ${decision.campaignId}` : "/confirm";
    case "help": return "/help";
    default: return undefined;
  }
}

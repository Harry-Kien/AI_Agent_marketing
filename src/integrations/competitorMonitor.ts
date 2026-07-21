import {
  type CompetitorAlertView,
  type CompetitorChangeEvent,
  type CompetitorChangeType,
  type CompetitorImpact,
  type CompetitorReadModel,
  type CompetitorSignal,
  type CompetitorSnapshot
} from "../domain/competitorTypes";

// Mức ảnh hưởng mặc định theo loại thay đổi khi tín hiệu không tự khai báo impactHint.
const defaultImpactByType: Record<CompetitorChangeType, CompetitorImpact> = {
  pricing_change: "high",
  ad_push: "high",
  new_campaign: "medium",
  feature_release: "low"
};

const impactRank: Record<CompetitorImpact, number> = { high: 0, medium: 1, low: 2 };

const nowIso = () => new Date().toISOString();

// Hash ổn định, không phụ thuộc môi trường, để tạo dedupKey/id có thể tái lập trong test.
function stableHash(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return (hash >>> 0).toString(36);
}

function signalMapKey(signal: Pick<CompetitorSignal, "category" | "key">): string {
  return `${signal.category}::${signal.key}`;
}

// Bảng đề xuất phản hồi theo loại (rule-based). Đây là chỗ sau này thay bằng gợi ý AI thật;
// giữ thuần hàm để K01 xác định được và test được mà không cần gọi API.
function suggestResponse(type: CompetitorChangeType, name: string): string {
  switch (type) {
    case "pricing_change":
      return `Đối thủ ${name} vừa đổi giá. Cân nhắc chiến dịch nhấn giá trị và minh bạch chi phí thay vì đua giá.`;
    case "new_campaign":
      return `Đối thủ ${name} chạy chiến dịch mới. Đề xuất tạo lead-magnet đối trọng và bảo vệ tệp khách hàng hiện có.`;
    case "feature_release":
      return `Đối thủ ${name} ra tính năng mới. Rà soát tài liệu so sánh và làm nổi bật điểm khác biệt của mình.`;
    case "ad_push":
      return `Đối thủ ${name} tăng ngân sách quảng cáo. Tối ưu từ khóa và điểm chất lượng nội dung để giữ hiển thị tự nhiên.`;
  }
}

function buildEvent(
  snapshot: CompetitorSnapshot,
  signal: CompetitorSignal,
  changeKind: "new" | "changed",
  previousValue: string | undefined,
  now: () => string
): CompetitorChangeEvent {
  const impact = signal.impactHint ?? defaultImpactByType[signal.category];
  const dedupKey = `${snapshot.competitorId}::${signalMapKey(signal)}::${stableHash(signal.value)}`;
  const detail =
    changeKind === "changed" && previousValue !== undefined
      ? `${signal.label}: ${previousValue} → ${signal.value}`
      : `${signal.label}: ${signal.value}`;
  return {
    id: dedupKey,
    dedupKey,
    competitorId: snapshot.competitorId,
    name: snapshot.name,
    type: signal.category,
    changeKind,
    label: signal.label,
    detail,
    previousValue,
    currentValue: signal.value,
    impact,
    confidence: changeKind === "changed" ? 0.9 : 0.75,
    recommendedResponse: suggestResponse(signal.category, snapshot.name),
    source: snapshot.source,
    detectedAt: now(),
    evidence: [
      {
        source: snapshot.source,
        capturedAt: snapshot.capturedAt,
        note:
          changeKind === "changed"
            ? `Thay đổi từ "${previousValue}" thành "${signal.value}".`
            : `Phát hiện mới: "${signal.value}".`
      }
    ]
  };
}

// So sánh hai ảnh chụp của CÙNG một đối thủ và trả về danh sách thay đổi (thêm mới hoặc đổi giá trị).
export function detectCompetitorChanges(
  previous: CompetitorSnapshot | undefined,
  current: CompetitorSnapshot,
  now: () => string = nowIso
): CompetitorChangeEvent[] {
  const previousByKey = new Map<string, CompetitorSignal>();
  for (const signal of previous?.signals ?? []) {
    previousByKey.set(signalMapKey(signal), signal);
  }

  const events: CompetitorChangeEvent[] = [];
  for (const signal of current.signals) {
    const prior = previousByKey.get(signalMapKey(signal));
    if (!prior) {
      events.push(buildEvent(current, signal, "new", undefined, now));
    } else if (prior.value !== signal.value) {
      events.push(buildEvent(current, signal, "changed", prior.value, now));
    }
  }
  return events;
}

// Gộp danh sách sự kiện đã biết với sự kiện mới, khử trùng theo dedupKey và giữ detectedAt sớm nhất.
export function mergeCompetitorEvents(
  known: CompetitorChangeEvent[],
  incoming: CompetitorChangeEvent[]
): { merged: CompetitorChangeEvent[]; added: CompetitorChangeEvent[] } {
  const byKey = new Map<string, CompetitorChangeEvent>();
  for (const event of known) byKey.set(event.dedupKey, event);
  const added: CompetitorChangeEvent[] = [];
  for (const event of incoming) {
    if (byKey.has(event.dedupKey)) continue;
    byKey.set(event.dedupKey, event);
    added.push(event);
  }
  return { merged: sortEvents([...byKey.values()]), added };
}

function sortEvents(events: CompetitorChangeEvent[]): CompetitorChangeEvent[] {
  return [...events].sort((a, b) => {
    const byImpact = impactRank[a.impact] - impactRank[b.impact];
    if (byImpact !== 0) return byImpact;
    return b.detectedAt.localeCompare(a.detectedAt);
  });
}

export interface CompetitorScanInput {
  previous?: CompetitorSnapshot[];
  current: CompetitorSnapshot[];
  known?: CompetitorChangeEvent[];
  now?: () => string;
}

// Quét một vòng: ghép ảnh cũ/mới theo competitorId, phát hiện thay đổi, khử trùng và sắp xếp.
export function runCompetitorScan(input: CompetitorScanInput): {
  events: CompetitorChangeEvent[];
  added: CompetitorChangeEvent[];
} {
  const now = input.now ?? nowIso;
  const previousById = new Map<string, CompetitorSnapshot>();
  for (const snapshot of input.previous ?? []) previousById.set(snapshot.competitorId, snapshot);

  const detected: CompetitorChangeEvent[] = [];
  for (const snapshot of input.current) {
    detected.push(...detectCompetitorChanges(previousById.get(snapshot.competitorId), snapshot, now));
  }
  const { merged, added } = mergeCompetitorEvents(input.known ?? [], detected);
  return { events: merged, added };
}

// Read model đã redacted cho dashboard: chỉ giữ đúng trường UI cần, bỏ dedupKey/confidence/evidence.
export function buildCompetitorReadModel(
  events: CompetitorChangeEvent[],
  options: { connected?: boolean; now?: () => string; locale?: string } = {}
): CompetitorReadModel {
  const now = options.now ?? nowIso;
  const locale = options.locale ?? "vi-VN";
  return {
    connected: options.connected ?? true,
    generatedAt: now(),
    alerts: sortEvents(events).map((event) => ({
      id: event.id,
      name: event.name,
      type: event.type,
      detail: event.detail,
      impact: event.impact,
      time: new Date(event.detectedAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }),
      suggestedAction: event.recommendedResponse
    } satisfies CompetitorAlertView))
  };
}

// Fixture mẫu dùng cho endpoint demo và test. Hai đối thủ, phản chiếu dữ liệu UI đang hardcode.
export const sampleCompetitorBaseline: CompetitorSnapshot[] = [
  {
    competitorId: "ai-agency-x",
    name: "AI Agency X",
    source: "fixture:pricing-page",
    capturedAt: "2026-07-20T09:00:00.000Z",
    signals: [
      { category: "pricing_change", key: "plan:setup-sme", label: "Gói thiết lập AI Agent cho SME", value: "5.0tr/tháng" }
    ]
  },
  {
    competitorId: "martech-core",
    name: "MarTech Core",
    source: "fixture:ad-library",
    capturedAt: "2026-07-20T09:00:00.000Z",
    signals: [
      { category: "ad_push", key: "ads:content-automation", label: "Ngân sách quảng cáo 'Tự động hóa Content'", value: "Mức nền" }
    ]
  }
];

export const sampleCompetitorLatest: CompetitorSnapshot[] = [
  {
    competitorId: "ai-agency-x",
    name: "AI Agency X",
    source: "fixture:pricing-page",
    capturedAt: "2026-07-21T10:15:00.000Z",
    signals: [
      { category: "pricing_change", key: "plan:setup-sme", label: "Gói thiết lập AI Agent cho SME", value: "4.2tr/tháng (giảm 15%)" }
    ]
  },
  {
    competitorId: "hoc-vien-y",
    name: "Học viện Marketing Y",
    source: "fixture:facebook-page",
    capturedAt: "2026-07-21T08:30:00.000Z",
    signals: [
      { category: "new_campaign", key: "campaign:webinar-ai-hr", label: "Chuỗi webinar 'ChatGPT & AI Automation'", value: "Miễn phí để lấy leads" }
    ]
  },
  {
    competitorId: "martech-core",
    name: "MarTech Core",
    source: "fixture:ad-library",
    capturedAt: "2026-07-21T07:00:00.000Z",
    signals: [
      { category: "ad_push", key: "ads:content-automation", label: "Ngân sách quảng cáo 'Tự động hóa Content'", value: "Tăng 40%" }
    ]
  }
];

// Nguồn sự kiện mặc định cho Control API khi chưa cắm nguồn thật: quét baseline -> latest.
export function defaultCompetitorEvents(now: () => string = nowIso): CompetitorChangeEvent[] {
  return runCompetitorScan({
    previous: sampleCompetitorBaseline,
    current: sampleCompetitorLatest,
    now
  }).events;
}

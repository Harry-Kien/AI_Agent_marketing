import type { AgentWorkProduct } from "./agentWorkProduct";
import type { AiProviderConfig } from "./aiProvider";

// Chấm điểm ĐỘC LẬP output của agent (không dùng điểm agent tự khai) — chuẩn tin cậy 2026.
export interface EvalDimensions {
  relevance: number; // bám brief
  brandSafety: number; // không claim phóng đại/nguy hiểm
  completeness: number; // đủ deliverable/evidence/risk
  grounding: number; // có căn cứ, không bịa
}

export interface AgentEvalResult {
  score: number; // 0..100 tổng hợp
  verdict: "pass" | "revise" | "block";
  dimensions: EvalDimensions;
  issues: string[];
  mode: "heuristic" | "llm";
}

// Claim bị cấm trong marketing (phóng đại, cam kết tuyệt đối) — vi phạm an toàn thương hiệu.
const bannedClaimPattern =
  /(cam kết doanh thu|đảm bảo lợi nhuận|chắc chắn giàu|số 1 việt nam|tốt nhất việt nam|duy nhất trên thị trường|tuyệt đối an toàn|100% thành công|x\d+ doanh thu|thần tốc làm giàu|lãi khủng)/i;

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function collectText(product: AgentWorkProduct): string {
  return [product.summary, ...product.deliverables, ...product.evidence, product.publication_content ?? ""].join(" ");
}

// Bộ chấm heuristic xác định (chạy không cần API).
export function heuristicEval(product: AgentWorkProduct, topic: string): AgentEvalResult {
  const issues: string[] = [];
  const text = collectText(product);

  // Brand safety.
  let brandSafety = 100;
  if (bannedClaimPattern.test(text)) {
    brandSafety = 30;
    issues.push("Phát hiện claim phóng đại/cam kết tuyệt đối — vi phạm an toàn thương hiệu.");
  }

  // Completeness theo số lượng thành phần.
  const completeness = clamp(
    45 +
      Math.min(product.deliverables.length, 4) * 8 +
      Math.min(product.evidence.length, 4) * 5 +
      Math.min(product.risks.length, 3) * 3
  );

  // Grounding: có bằng chứng và không phải toàn giả định.
  const assumptionOnly = product.evidence.every((item) => /giả định|phỏng đoán|tự nghĩ/i.test(item));
  const grounding = product.evidence.length === 0 || assumptionOnly ? 45 : 85;
  if (grounding < 60) issues.push("Thiếu căn cứ/nguồn thực tế, chủ yếu là giả định.");

  // Relevance: độ trùng token giữa output và brief.
  const topicTerms = new Set(tokenize(topic));
  const outputTerms = new Set(tokenize(text));
  const overlap = [...topicTerms].filter((term) => outputTerms.has(term)).length;
  const relevance = topicTerms.size === 0 ? 70 : clamp(40 + (overlap / topicTerms.size) * 60);
  if (relevance < 55) issues.push("Nội dung chưa bám sát yêu cầu chiến dịch.");

  const dimensions: EvalDimensions = { relevance, brandSafety, completeness, grounding };
  const score = clamp(relevance * 0.3 + brandSafety * 0.3 + completeness * 0.2 + grounding * 0.2);
  const verdict: AgentEvalResult["verdict"] = brandSafety < 50 ? "block" : score < 70 ? "revise" : "pass";
  return { score, verdict, dimensions, issues, mode: "heuristic" };
}

type FetchLike = typeof fetch;

// Chấm bằng LLM-as-judge khi AI bật; lỗi/timeout thì fallback về heuristic (guarded).
export async function evaluateAgentOutput(
  product: AgentWorkProduct,
  options: { topic: string; ai?: AiProviderConfig; fetchImpl?: FetchLike }
): Promise<AgentEvalResult> {
  const heuristic = heuristicEval(product, options.topic);
  const ai = options.ai;
  if (!ai?.enabled) return heuristic;

  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(`${ai.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(ai.apiKey ? { authorization: `Bearer ${ai.apiKey}` } : {})
      },
      signal: AbortSignal.timeout(ai.timeoutMs ?? 30_000),
      body: JSON.stringify({
        model: ai.model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Bạn là giám khảo QA marketing độc lập. Chấm output theo relevance, brandSafety, completeness, grounding (0-100). Chặn (block) nếu có claim phóng đại/cam kết tuyệt đối. Chỉ trả JSON."
          },
          {
            role: "user",
            content: `Chủ đề: ${options.topic}\nOutput:\n${collectText(product)}\nTrả JSON: {"relevance":int,"brandSafety":int,"completeness":int,"grounding":int,"issues":string[]}`
          }
        ]
      })
    });
    if (!response.ok) return heuristic;
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = payload.choices?.[0]?.message?.content;
    if (!raw) return heuristic;
    const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")) as Partial<EvalDimensions> & {
      issues?: string[];
    };
    const dimensions: EvalDimensions = {
      relevance: clamp(parsed.relevance ?? heuristic.dimensions.relevance),
      brandSafety: clamp(parsed.brandSafety ?? heuristic.dimensions.brandSafety),
      completeness: clamp(parsed.completeness ?? heuristic.dimensions.completeness),
      grounding: clamp(parsed.grounding ?? heuristic.dimensions.grounding)
    };
    const score = clamp(
      dimensions.relevance * 0.3 + dimensions.brandSafety * 0.3 + dimensions.completeness * 0.2 + dimensions.grounding * 0.2
    );
    const verdict: AgentEvalResult["verdict"] =
      dimensions.brandSafety < 50 ? "block" : score < 70 ? "revise" : "pass";
    return { score, verdict, dimensions, issues: parsed.issues ?? [], mode: "llm" };
  } catch {
    return heuristic;
  }
}

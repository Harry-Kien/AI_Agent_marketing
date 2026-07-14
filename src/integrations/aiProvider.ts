import type { MarketingBotRole } from "./telegramAdapter";

export interface AiProviderConfig {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface MarketingPromptInput {
  role: MarketingBotRole;
  command: string;
  topic: string;
  context?: string;
}

export interface MarketingPrompt {
  system: string;
  user: string;
}

export interface MarketingAgentOutput {
  mode: "ai" | "mock";
  text: string;
}

type EnvLike = Record<string, string | undefined>;
type FetchLike = typeof fetch;

const defaultBaseUrl = "https://api.9router.com/v1";
const defaultModel = "openai/gpt-4.1-mini";
const roleBoundaries: Record<MarketingBotRole, string> = {
  manager:
    "Chỉ điều phối, ưu tiên, giao việc, tổng hợp và yêu cầu phê duyệt. Không viết thay toàn bộ nội dung chuyên môn của phòng ban.",
  "market-radar":
    "Chỉ làm nghiên cứu thị trường: insight, audience, đối thủ, pain point, góc truyền thông. Không viết bài hoàn chỉnh, không review thương hiệu thay Performance Brand.",
  "content-creator":
    "Chỉ sản xuất nội dung dựa trên brief: hook, bài social, caption, script, CTA. Không bịa số liệu thị trường, không tự claim đã đăng bài.",
  "performance-brand":
    "Chỉ review và tối ưu: tone thương hiệu, rủi ro claim, CTA, KPI, checklist phê duyệt. Không viết lại toàn bộ bài nếu không cần."
};

const roleSkills: Record<
  MarketingBotRole,
  {
    name: string;
    mission: string;
    skills: string[];
    qualityGate: string;
  }
> = {
  manager: {
    name: "Marketing Manager Bot",
    mission: "Điều hành AI Marketing Command Center cho doanh nghiệp một người.",
    skills: [
      "phân loại chiến dịch",
      "giao việc cho phòng ban",
      "quản lý phê duyệt",
      "tổng hợp brief hằng ngày",
      "hỗ trợ quyết định cho người vận hành"
    ],
    qualityGate: "Mọi hành động có người phụ trách, bước tiếp theo, bằng chứng và phê duyệt của con người."
  },
  "market-radar": {
    name: "Market Radar Bot",
    mission: "Tìm tín hiệu xu hướng, khách hàng, đối thủ và định vị.",
    skills: [
      "quét xu hướng",
      "lập bản đồ đối thủ",
      "phân tích nỗi đau khách hàng",
      "rút insight",
      "thiết kế góc truyền thông"
    ],
    qualityGate: "Insight phải nối được nỗi đau khách hàng, thời điểm thị trường, khoảng trống đối thủ và góc chiến dịch dùng được."
  },
  "content-creator": {
    name: "Content Creator Bot",
    mission: "Biến chiến lược chiến dịch thành bản nháp nội dung có thể dùng và luôn chờ phê duyệt.",
    skills: [
      "viết bài social",
      "viết caption",
      "viết kịch bản video ngắn",
      "tạo hook",
      "lập lịch nội dung"
    ],
    qualityGate: "Nội dung có hook, giá trị, CTA, đúng giọng thương hiệu và không có claim thiếu căn cứ."
  },
  "performance-brand": {
    name: "Performance Brand Bot",
    mission: "Bảo vệ chất lượng thương hiệu và biến chiến dịch thành cải tiến đo lường được.",
    skills: [
      "review tone thương hiệu",
      "tối ưu CTA",
      "QA nội dung",
      "thiết kế KPI",
      "báo cáo hiệu quả"
    ],
    qualityGate: "Output đạt yêu cầu về thương hiệu, tuân thủ, độ rõ CTA và sẵn sàng đo lường."
  }
};

export function createAiProviderConfig(env: EnvLike): AiProviderConfig {
  const apiKey = env.NINE_ROUTER_API_KEY ?? env.NINEROUTER_API_KEY ?? env.OPENAI_API_KEY ?? "";
  const forceEnabled = ["1", "true", "yes", "on"].includes(
    (env.NINE_ROUTER_ENABLED ?? env.NINEROUTER_ENABLED ?? "").toLowerCase()
  );
  return {
    enabled: Boolean(apiKey) || forceEnabled,
    baseUrl: (env.NINE_ROUTER_BASE_URL ?? env.NINEROUTER_BASE_URL ?? defaultBaseUrl).replace(/\/$/, ""),
    apiKey,
    model: env.NINE_ROUTER_MODEL ?? env.NINEROUTER_MODEL ?? defaultModel
  };
}

export function buildMarketingPrompt(input: MarketingPromptInput): MarketingPrompt {
  const profile = roleSkills[input.role];
  return {
    system: [
      `Bạn là ${profile.name}.`,
      profile.mission,
      `Bộ kỹ năng: ${profile.skills.join(", ")}.`,
      `Cổng chất lượng: ${profile.qualityGate}`,
      `Ranh giới vai trò: ${roleBoundaries[input.role]}`,
      "Bạn làm việc trong một hệ vận hành marketing human-in-the-loop.",
      "Không được khẳng định rằng nội dung đã được đăng, tiền đã được chi, hoặc hệ thống bên ngoài đã bị thay đổi.",
      "Trả lời đúng trọng tâm nhiệm vụ của vai trò hiện tại, không lặp lại phần của bot khác.",
      "Trả lời bằng tiếng Việt, gọn, có cấu trúc, phù hợp để hiển thị trong Telegram.",
      "Tuyệt đối không dùng Markdown thô như **, ###, [] hoặc bảng. Dùng tiêu đề ngắn và bullet thường.",
      "Giữ câu trả lời trong 900-1200 ký tự, ưu tiên quyết định và hành động tiếp theo."
    ].join("\n"),
    user: [
      `Lệnh: /${input.command}`,
      `Chủ đề: ${input.topic}`,
      `Bối cảnh: ${input.context ?? "Demo Telegram local trước khi tích hợp Lark."}`,
      "Bắt buộc có đúng 5 mục: Tóm tắt, Đề xuất, Cần kiểm tra, Rủi ro, Chờ duyệt.",
      "Không viết chung chung. Mỗi ý phải giúp người quản lý ra quyết định hoặc chuyển bước tiếp theo.",
      "Mỗi mục tối đa 2-3 bullet. Không dùng ký tự Markdown trang trí.",
      "Nhắc lại: mọi hành động launch, đăng bài, chạy ads hoặc gửi ra ngoài đều cần con người phê duyệt."
    ].join("\n")
  };
}

export async function generateMarketingAgentOutput(
  config: AiProviderConfig,
  input: MarketingPromptInput,
  fetchImpl: FetchLike = fetch
): Promise<MarketingAgentOutput> {
  const prompt = buildMarketingPrompt(input);
  if (!config.enabled) {
    return {
      mode: "mock",
      text: buildMockOutput(input)
    };
  }

  const headers: Record<string, string> = {
    "content-type": "application/json"
  };
  if (config.apiKey) {
    headers.authorization = `Bearer ${config.apiKey}`;
  }

  const response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user }
      ],
      temperature: 0.35,
      max_tokens: 650
    })
  });

  if (!response.ok) {
    throw new Error(`AI provider request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("AI provider returned an empty response.");
  }

  return { mode: "ai", text };
}

function buildMockOutput(input: MarketingPromptInput) {
  const profile = roleSkills[input.role];
  return [
    `${profile.name} output mô phỏng cho /${input.command}`,
    `Tóm tắt: ${input.topic}`,
    `Kết quả đề xuất: áp dụng ${profile.skills.slice(0, 3).join(", ")} cho chiến dịch.`,
    `Cổng chất lượng: ${profile.qualityGate}`,
    "Rủi ro: chưa gọi 9Router API, đây là output mô phỏng để demo.",
    "Cần phê duyệt: người quản lý phải duyệt trước khi đăng, chạy ads hoặc gửi ra ngoài."
  ].join("\n");
}

import type { AiProviderConfig } from "./aiProvider";
import type { MarketingBotConfig, MarketingBotRole } from "./telegramAdapter";

type EnvLike = Record<string, string | undefined>;

export interface TelegramIdentity {
  chatId: string;
  userId: string;
}

export type TelegramAuthorizationResult =
  | { allowed: true }
  | {
      allowed: false;
      reason: "missing_configuration" | "wrong_group" | "wrong_operator";
    };

export interface AgentHandoffOutput {
  role: Exclude<MarketingBotRole, "manager">;
  output: string;
}

export function evaluateTelegramAuthorization(
  env: EnvLike,
  identity: TelegramIdentity
): TelegramAuthorizationResult {
  const groupId = env.TELEGRAM_GROUP_ID?.trim();
  const operatorId = env.OPERATOR_TELEGRAM_USER_ID?.trim();

  if (!groupId || !operatorId) {
    return { allowed: false, reason: "missing_configuration" };
  }
  if (identity.chatId !== groupId) {
    return { allowed: false, reason: "wrong_group" };
  }
  if (identity.userId !== operatorId) {
    return { allowed: false, reason: "wrong_operator" };
  }
  return { allowed: true };
}

export function cleanTelegramText(text: string) {
  return text
    .replace(/\*\*/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*-\s*\[\s?\]\s*/gm, "- ")
    .replace(/`/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function buildAgentHandoffContext(outputs: AgentHandoffOutput[]) {
  if (outputs.length === 0) {
    return "Chưa có output phòng ban trước. Hãy xử lý từ brief chiến dịch.";
  }

  return outputs
    .map(({ role, output }) => {
      const label = role.replace(/-/g, " ").toUpperCase();
      return `${label}\n${cleanTelegramText(output).slice(0, 1600)}`;
    })
    .join("\n\n")
    .slice(0, 3600);
}

export function formatRuntimeHealth(input: {
  botCount: number;
  aiEnabled: boolean;
  aiModel: string;
  groupConfigured: boolean;
  operatorConfigured: boolean;
}) {
  const checks = [
    input.botCount === 6,
    input.groupConfigured,
    input.operatorConfigured
  ];
  const ready = checks.every(Boolean);

  return [
    "Tình trạng AI Marketing Command Center",
    `Bot Telegram: ${input.botCount}/6`,
    `AI Provider: ${input.aiEnabled ? `đang bật (${input.aiModel})` : "mô phỏng local"}`,
    `Khóa Group: ${input.groupConfigured ? "đã cấu hình" : "chưa cấu hình"}`,
    `Khóa Operator: ${input.operatorConfigured ? "đã cấu hình" : "chưa cấu hình"}`,
    `Sẵn sàng nhận lệnh: ${ready ? "CÓ" : "CHƯA"}`,
    "Hành động publish, chạy ads và gửi ra ngoài luôn cần con người phê duyệt."
  ].join("\n");
}

export function buildRuntimeHealthFromConfig(
  configs: MarketingBotConfig[],
  aiConfig: AiProviderConfig,
  env: EnvLike
) {
  return formatRuntimeHealth({
    botCount: configs.length,
    aiEnabled: aiConfig.enabled,
    aiModel: aiConfig.model,
    groupConfigured: Boolean(env.TELEGRAM_GROUP_ID?.trim()),
    operatorConfigured: Boolean(env.OPERATOR_TELEGRAM_USER_ID?.trim())
  });
}

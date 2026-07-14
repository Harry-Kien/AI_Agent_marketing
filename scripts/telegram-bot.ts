import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { seedData } from "../src/data/seed";
import {
  createAiProviderConfig,
  generateMarketingAgentOutput
} from "../src/integrations/aiProvider";
import {
  createTelegramSession,
  getMarketingCampaignHandoffs,
  getMarketingBotConfigsFromEnv,
  handleMarketingTeamCommand,
  handleTelegramCommand,
  type MarketingBotConfig,
  type TelegramSession
} from "../src/integrations/telegramAdapter";

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    text?: string;
    chat: { id: number | string; type: string };
    from?: { id: number | string; username?: string };
  };
}

const specialistCommands = new Set([
  "trend",
  "competitor",
  "audience",
  "insight",
  "angle",
  "post",
  "caption",
  "script",
  "calendar",
  "hook",
  "review",
  "brandcheck",
  "cta",
  "measure"
]);

const managerCommands = new Set([
  "start",
  "help",
  "brief",
  "flow",
  "campaign",
  "tasks",
  "run",
  "approve",
  "reject",
  "report",
  "whoami"
]);

const roleCommands: Record<string, Set<string>> = {
  manager: managerCommands,
  "market-radar": new Set(["start", "help", "trend", "competitor", "audience", "insight", "angle", "whoami"]),
  "content-creator": new Set(["start", "help", "post", "caption", "script", "calendar", "hook", "whoami"]),
  "performance-brand": new Set(["start", "help", "review", "brandcheck", "cta", "measure", "report", "whoami"])
};

const campaignAutoRuns: Record<string, string> = {
  "market-radar": "trend",
  "content-creator": "post",
  "performance-brand": "review"
};

function loadDotEnv() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...valueParts] = trimmed.split("=");
    if (!process.env[key]) {
      process.env[key] = valueParts.join("=").replace(/^["']|["']$/g, "");
    }
  }
}

function isAllowed(update: TelegramUpdate) {
  const groupId = process.env.TELEGRAM_GROUP_ID;
  const operatorId = process.env.OPERATOR_TELEGRAM_USER_ID;
  const chatId = String(update.message?.chat.id ?? "");
  const userId = String(update.message?.from?.id ?? "");

  if (groupId && chatId !== groupId) return false;
  if (operatorId && userId !== operatorId) return false;
  return true;
}

function parseCommand(text: string) {
  const raw = text.trim();
  if (!raw.startsWith("/")) return { command: "natural", args: [raw] };
  const [head = "", ...args] = raw.split(/\s+/).filter(Boolean);
  return {
    command: head.replace(/^\//, "").split("@")[0].toLowerCase(),
    args
  };
}

function shouldBotHandleMessage(role: string, command: string) {
  if (command === "natural") return role === "manager";
  return roleCommands[role]?.has(command) ?? false;
}

function normalizeMessageForRole(role: string, text: string, command: string) {
  if (role === "manager" && command === "natural") {
    return `/campaign ${text.trim()}`;
  }
  return text;
}

function formatWhoami(update: TelegramUpdate) {
  const chat = update.message?.chat;
  const from = update.message?.from;
  return [
    "Thông tin khóa quyền Telegram",
    `TELEGRAM_GROUP_ID=${chat?.id ?? ""}`,
    `OPERATOR_TELEGRAM_USER_ID=${from?.id ?? ""}`,
    `Chat type: ${chat?.type ?? "unknown"}`,
    `Username: ${from?.username ? `@${from.username}` : "unknown"}`,
    "Hai giá trị này dùng để khóa đúng group và đúng người quản lý được phê duyệt."
  ].join("\n");
}

function isCampaignCommand(role: string, command: string) {
  return role === "manager" && command === "campaign";
}

function getBotConfigs(): MarketingBotConfig[] {
  try {
    return getMarketingBotConfigsFromEnv(process.env);
  } catch (error) {
    const fallbackToken = process.env.TELEGRAM_BOT_TOKEN;
    if (fallbackToken) {
      return [
        {
          role: "manager",
          token: fallbackToken,
          displayName: "Marketing Manager Bot",
          commands: ["brief", "flow", "campaign", "tasks", "run", "approve", "reject", "report", "whoami", "help"],
          shortDescription: "AI marketing manager for campaign orchestration and approvals.",
          description:
            "AI Marketing Command Center manager. Creates campaigns, delegates work to specialist bots, tracks task flow, and keeps human approval before publishing, launching, or spending."
        }
      ];
    }

    throw error;
  }
}

async function telegramApi<T>(
  token: string,
  method: string,
  body: Record<string, unknown>
): Promise<T> {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = (await response.json()) as { ok: boolean; result?: T; description?: string };
  if (!payload.ok) {
    throw new Error(payload.description ?? `Telegram API error while calling ${method}`);
  }
  return payload.result as T;
}

async function sendMessage(token: string, chatId: number | string, text: string) {
  await telegramApi(token, "sendMessage", {
    chat_id: chatId,
    text: text.slice(0, 3900),
    disable_web_page_preview: true
  });
}

async function sendTyping(token: string, chatId: number | string) {
  await telegramApi(token, "sendChatAction", {
    chat_id: chatId,
    action: "typing"
  });
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function coordinationMessage(role: string, topic: string) {
  const messages: Record<string, string> = {
    "market-radar": [
      "Tôi nhận phần nghiên cứu thị trường.",
      `Tôi sẽ lọc insight, khách hàng mục tiêu, đối thủ và góc truyền thông cho: ${topic}.`,
      "Kết quả sẽ được chuyển cho Content Creator để viết đúng trọng tâm."
    ].join("\n"),
    "content-creator": [
      "Tôi nhận phần sản xuất nội dung.",
      `Tôi sẽ dùng insight chiến dịch để tạo hook, bài social, CTA và biến thể nội dung cho: ${topic}.`,
      "Bản nháp vẫn cần Manager phê duyệt trước khi đăng."
    ].join("\n"),
    "performance-brand": [
      "Tôi nhận phần kiểm duyệt chất lượng.",
      `Tôi sẽ rà soát tone thương hiệu, CTA, rủi ro claim và KPI cho: ${topic}.`,
      "Không launch, không chạy ads, không publish khi chưa có phê duyệt."
    ].join("\n")
  };
  return messages[role] ?? `Tôi nhận nhiệm vụ cho: ${topic}.`;
}

function cleanTelegramText(text: string) {
  return text
    .replace(/\*\*/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*-\s*\[\s?\]\s*/gm, "- ")
    .replace(/`/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function newestRunId(session: TelegramSession) {
  return session.pendingApprovals[0]?.run_id;
}

function formatAiReply(
  target: MarketingBotConfig,
  aiMode: string,
  text: string,
  runId?: string
) {
  return [
    `${target.displayName} - Kết quả chuyên môn`,
    cleanTelegramText(text),
    runId ? `Chờ duyệt: /approve ${runId} hoặc /reject ${runId}` : "Chờ Manager kiểm tra trước khi dùng.",
    aiMode === "ai" ? "Nguồn xử lý: 9Router AI" : "Nguồn xử lý: mô phỏng local"
  ].join("\n\n");
}

async function runSpecialistDepartment(
  target: MarketingBotConfig,
  chatId: number | string,
  topic: string,
  state: { session: TelegramSession }
) {
  const command = campaignAutoRuns[target.role];
  if (!command) return;

  await sendTyping(target.token, chatId);
  await wait(700);
  await sendMessage(target.token, chatId, coordinationMessage(target.role, topic));
  await sendTyping(target.token, chatId);

  const specialistText = `/${command} ${topic}`;
  const result = handleMarketingTeamCommand(state.session, specialistText, target.role);
  state.session = result.session;
  const runId = newestRunId(state.session);

  await sendTyping(target.token, chatId);
  const aiOutput = await generateMarketingAgentOutput(createAiProviderConfig(process.env), {
    role: target.role,
    command,
    topic,
    context: "Auto-run from Marketing Manager campaign orchestration"
  });

  await wait(700);
  await sendMessage(
    target.token,
    chatId,
    formatAiReply(target, aiOutput.mode, aiOutput.text, runId)
  );
}

async function pollBot(
  config: MarketingBotConfig,
  allConfigs: MarketingBotConfig[],
  state: { session: TelegramSession }
) {
  let offset = 0;
  console.log(`${config.displayName} is running.`);

  while (true) {
    const updates = await telegramApi<TelegramUpdate[]>(config.token, "getUpdates", {
      offset,
      timeout: 25,
      allowed_updates: ["message"]
    });

    for (const update of updates) {
      offset = update.update_id + 1;
      const message = update.message;
      if (!message?.text) continue;
      console.log(
        JSON.stringify({
          event: "telegram_message",
          bot: config.role,
          chat_id: message.chat.id,
          chat_type: message.chat.type,
          from_id: message.from?.id,
          from_username: message.from?.username,
          text: message.text.slice(0, 120)
        })
      );

      const parsed = parseCommand(message.text);
      if (!shouldBotHandleMessage(config.role, parsed.command)) {
        continue;
      }

      if (parsed.command === "whoami") {
        if ((process.env.TELEGRAM_GROUP_ID || process.env.OPERATOR_TELEGRAM_USER_ID) && !isAllowed(update)) {
          await sendMessage(
            config.token,
            message.chat.id,
            "Command Center chỉ hiển thị thông tin khóa quyền cho group và người quản lý đã cấu hình."
          );
          continue;
        }
        await sendMessage(config.token, message.chat.id, formatWhoami(update));
        continue;
      }

      if (!isAllowed(update)) {
        await sendMessage(
          config.token,
          message.chat.id,
          "Command Center chỉ nhận lệnh từ group và người quản lý đã cấu hình."
        );
        continue;
      }

      try {
        const hasMarketingTeam = Boolean(process.env.TELEGRAM_MARKET_RADAR_BOT_TOKEN);
        const routedText = normalizeMessageForRole(config.role, message.text, parsed.command);
        const routedParsed = parseCommand(routedText);
        const result = hasMarketingTeam
          ? handleMarketingTeamCommand(state.session, routedText, config.role)
          : handleTelegramCommand(state.session, routedText);
        state.session = result.session;

        if (hasMarketingTeam && config.role !== "manager" && specialistCommands.has(routedParsed.command)) {
          const runId = newestRunId(state.session);
          const aiOutput = await generateMarketingAgentOutput(createAiProviderConfig(process.env), {
            role: config.role,
            command: routedParsed.command,
            topic: routedParsed.args.join(" ").trim() || "AI Agent service for SME",
            context: "Telegram AI Marketing Command Center demo"
          });
          result.messages = [formatAiReply(config, aiOutput.mode, aiOutput.text, runId)];
        }

        for (const reply of result.messages) {
          await sendMessage(config.token, message.chat.id, reply);
        }

        if (hasMarketingTeam && isCampaignCommand(config.role, routedParsed.command)) {
          const configsByRole = Object.fromEntries(
            allConfigs.map((item) => [item.role, item])
          ) as Record<string, MarketingBotConfig>;
          const topic = routedParsed.args.join(" ").trim() || "AI Agent service for SME";
          for (const handoff of getMarketingCampaignHandoffs(topic)) {
            const target = configsByRole[handoff.role];
            if (target) {
              await sendMessage(target.token, message.chat.id, handoff.message);
              await runSpecialistDepartment(target, message.chat.id, topic, state);
            }
          }
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Unknown error";
        await sendMessage(config.token, message.chat.id, `Lệnh chưa xử lý được: ${detail}`);
      }
    }
  }
}

async function poll() {
  loadDotEnv();

  const configs = getBotConfigs();
  const state = { session: createTelegramSession(seedData) };

  console.log("AI Marketing Command Center is running.");
  console.log("Configured bots:", configs.map((config) => config.displayName).join(", "));
  console.log("Use /brief, /campaign, /trend, /post, /review, /approve, /reject, /report.");

  await Promise.all(configs.map((config) => pollBot(config, configs, state)));
}

poll().catch((error) => {
  console.error(error);
  process.exit(1);
});

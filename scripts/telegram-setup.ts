import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  getMarketingBotCommandMenus,
  getMarketingBotConfigsFromEnv,
  type MarketingBotConfig
} from "../src/integrations/telegramAdapter";

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

async function telegramApi<T>(
  token: string,
  method: string,
  body: Record<string, unknown> = {}
): Promise<T> {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify(body)
  });
  const payload = (await response.json()) as { ok: boolean; result?: T; description?: string };
  if (!payload.ok) {
    throw new Error(payload.description ?? `Telegram API error while calling ${method}`);
  }
  return payload.result as T;
}

async function setupBot(config: MarketingBotConfig) {
  await telegramApi(config.token, "deleteWebhook", {
    drop_pending_updates: false
  });
  const me = await telegramApi<{ username: string; first_name: string }>(config.token, "getMe");
  const menus = getMarketingBotCommandMenus();
  await telegramApi(config.token, "setMyName", {
    name: config.displayName
  });
  await telegramApi(config.token, "setMyCommands", {
    commands: menus[config.role]
  });
  await telegramApi(config.token, "setMyShortDescription", {
    short_description: config.shortDescription
  });
  await telegramApi(config.token, "setMyDescription", {
    description: config.description
  });

  return {
    role: config.role,
    displayName: config.displayName,
    username: me.username,
    firstName: me.first_name,
    commands: menus[config.role].map((command) => `/${command.command}`)
  };
}

async function main() {
  loadDotEnv();
  const configs = getMarketingBotConfigsFromEnv(process.env);
  const results = [];

  for (const config of configs) {
    try {
      results.push({ ok: true, ...(await setupBot(config)) });
    } catch (error) {
      results.push({
        ok: false,
        role: config.role,
        displayName: config.displayName,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }

  console.log(JSON.stringify(results, null, 2));

  if (results.some((result) => !result.ok)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

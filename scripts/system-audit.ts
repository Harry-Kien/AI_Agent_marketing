import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createAiProviderConfig, generateMarketingAgentOutput } from "../src/integrations/aiProvider";
import { createMetaGraphClient, createMetaGraphConfig } from "../src/integrations/metaGraphAdapter";
import { getMarketingBotConfigsFromEnv } from "../src/integrations/telegramAdapter";

function loadDotEnv() {
  const path = resolve(process.cwd(), ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...parts] = trimmed.split("=");
    if (!process.env[key]) process.env[key] = parts.join("=").replace(/^["']|["']$/g, "");
  }
}

async function telegramCheck() {
  const configs = getMarketingBotConfigsFromEnv(process.env);
  return Promise.all(configs.map(async (config) => {
    try {
      const response = await fetch(`https://api.telegram.org/bot${config.token}/getMe`, { signal: AbortSignal.timeout(10_000) });
      const payload = await response.json() as { ok: boolean; result?: { username?: string }; description?: string };
      return { role: config.role, display_name: config.displayName, ok: payload.ok, username: payload.result?.username ?? null, error: payload.ok ? null : payload.description ?? "Telegram rejected credential" };
    } catch (error) {
      return { role: config.role, display_name: config.displayName, ok: false, username: null, error: error instanceof Error ? error.message : "Connection error" };
    }
  }));
}

async function main() {
  loadDotEnv();
  const telegram = await telegramCheck();
  const ai = await generateMarketingAgentOutput(createAiProviderConfig(process.env), {
    role: "market-radar",
    command: "trend",
    topic: "AI Agent cho doanh nghiệp SME",
    context: "System audit: output phải có schema và bằng chứng."
  });
  const metaConfig = createMetaGraphConfig(process.env);
  let meta: { ok: boolean; id?: string; name?: string; error?: string; granted_permissions?: string[]; capabilities?: Record<string, boolean> };
  try {
    const client = createMetaGraphClient(metaConfig);
    const [summary, grantedPermissions] = await Promise.all([
      client.readPageSummary(),
      client.readGrantedPermissions()
    ]);
    meta = {
      ok: true,
      ...summary,
      granted_permissions: grantedPermissions,
      capabilities: {
        read_engagement: grantedPermissions.includes("pages_read_engagement"),
        manage_posts: grantedPermissions.includes("pages_manage_posts"),
        manage_engagement: grantedPermissions.includes("pages_manage_engagement"),
        messaging: grantedPermissions.includes("pages_messaging")
      }
    };
  } catch (error) {
    meta = { ok: false, error: error instanceof Error ? error.message : "Meta connection error" };
  }
  let controlApi = false;
  try {
    const response = await fetch("http://127.0.0.1:8787/api/health", { signal: AbortSignal.timeout(3_000) });
    controlApi = response.ok;
  } catch { controlApi = false; }

  const activeBots = telegram.filter((item) => item.ok).length;
  const demoCoreReady = telegram.some((item) => item.role === "manager" && item.ok) && ai.mode === "ai" && controlApi;
  const allAgentsReady = activeBots === 6;
  const publicationReady = meta.ok && metaConfig.publishEnabled;
  const report = {
    checked_at: new Date().toISOString(),
    verdict: {
      demo_ready: demoCoreReady && activeBots >= 5,
      all_agents_ready: allAgentsReady,
      meta_connected: meta.ok,
      publication_ready: publicationReady,
      production_ready: demoCoreReady && allAgentsReady && publicationReady,
      active_telegram_bots: `${activeBots}/6`,
      manager_relay_required: telegram.filter((item) => !item.ok).map((item) => item.display_name)
    },
    telegram,
    ai_provider: {
      ok: ai.mode === "ai",
      structured_quality_score: ai.text.includes("ĐIỂM CHẤT LƯỢNG"),
      evidence_section: ai.text.includes("BẰNG CHỨNG"),
      fallback: ai.fallbackReason ?? null
    },
    meta_page: { ...meta, publish_enabled: metaConfig.publishEnabled, auto_reply_enabled: process.env.META_AUTO_REPLY_ENABLED === "true" },
    control_api: { ok: controlApi, url: "http://127.0.0.1:8787" }
  };
  console.log(JSON.stringify(report, null, 2));
  if (!report.verdict.demo_ready) process.exitCode = 1;
}

main().catch((error) => {
  console.error(JSON.stringify({ fatal: error instanceof Error ? error.message : "System audit failed" }));
  process.exit(1);
});

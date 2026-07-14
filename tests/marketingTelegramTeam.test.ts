import { describe, expect, it } from "vitest";
import { seedData } from "../src/data/seed";
import {
  createTelegramSession,
  getMarketingBotCommandMenus,
  getMarketingBotConfigsFromEnv,
  getMarketingCampaignHandoffs,
  handleMarketingTeamCommand
} from "../src/integrations/telegramAdapter";

describe("Marketing Telegram team adapter", () => {
  it("loads the four marketing bot tokens from environment without exposing token values", () => {
    const configs = getMarketingBotConfigsFromEnv({
      TELEGRAM_MANAGER_BOT_TOKEN: "manager-secret",
      TELEGRAM_MARKET_RADAR_BOT_TOKEN: "radar-secret",
      TELEGRAM_CONTENT_CREATOR_BOT_TOKEN: "content-secret",
      TELEGRAM_PERFORMANCE_BRAND_BOT_TOKEN: "brand-secret"
    });

    expect(configs.map((config) => config.role)).toEqual([
      "manager",
      "market-radar",
      "content-creator",
      "performance-brand"
    ]);
    expect(configs.map((config) => config.displayName)).toEqual([
      "Marketing Manager Bot",
      "Market Radar Bot",
      "Content Creator Bot",
      "Performance Brand Bot"
    ]);
    expect(configs.every((config) => config.shortDescription.length > 20)).toBe(true);
    expect(configs.every((config) => config.description.includes("Agent") || config.description.includes("phòng"))).toBe(true);
    expect(configs.some((config) => config.token.includes("secret"))).toBe(true);
  });

  it("defines a command menu for each marketing bot role", () => {
    const menus = getMarketingBotCommandMenus();

    expect(menus.manager.map((item) => item.command)).toEqual([
      "start",
      "help",
      "brief",
      "flow",
      "campaign",
      "campaigns",
      "status",
      "approvals",
      "audit",
      "tasks",
      "run",
      "approve",
      "reject",
      "revise",
      "health",
      "whoami",
      "report"
    ]);
    expect(menus["market-radar"].map((item) => item.command)).toContain("trend");
    expect(menus["content-creator"].map((item) => item.command)).toContain("post");
    expect(menus["performance-brand"].map((item) => item.command)).toContain("review");
  });

  it("shows a manager-specific help and golden marketing flow", () => {
    const session = createTelegramSession(seedData);
    const help = handleMarketingTeamCommand(session, "/help", "manager");
    const flow = handleMarketingTeamCommand(session, "/flow", "manager");

    expect(help.messages.join("\n")).toContain("Marketing Manager Bot");
    expect(help.messages.join("\n")).toContain("/campaign");
    expect(flow.messages.join("\n")).toContain("Luồng demo chuẩn");
    expect(flow.messages.join("\n")).toContain("Market Radar Bot");
    expect(flow.messages.join("\n")).toContain("phê duyệt");
  });

  it("creates a marketing campaign task through the manager bot", () => {
    const session = createTelegramSession(seedData);
    const result = handleMarketingTeamCommand(
      session,
      "/campaign ra mat dich vu AI Agent cho doanh nghiep nho",
      "manager"
    );

    expect(result.session.data.tasks).toHaveLength(seedData.tasks.length + 1);
    const task = result.session.data.tasks[0];
    expect(task.title).toContain("Campaign:");
    expect(task.assigned_agent).toBe("agent-pm");
    expect(task.quality_gate).toContain("phê duyệt");
    expect(result.messages.join("\n")).toContain("Đã tạo chiến dịch");
  });

  it("prepares specialist handoffs when the manager creates a campaign", () => {
    const handoffs = getMarketingCampaignHandoffs("AI Agent cho SME");

    expect(handoffs.map((handoff) => handoff.role)).toEqual([
      "market-radar",
      "content-creator",
      "performance-brand"
    ]);
    expect(handoffs[0].message).toContain("Nhiệm vụ");
    expect(handoffs[1].message).toContain("/post");
    expect(handoffs[2].message).toContain("Cổng phê duyệt");
  });

  it("keeps specialist bots silent for manager-only group commands", () => {
    const session = createTelegramSession(seedData);
    const result = handleMarketingTeamCommand(session, "/campaign ra mat san pham moi", "content-creator");

    expect(result.messages).toEqual([]);
  });

  it("routes specialist commands to the right marketing bot persona", () => {
    const session = createTelegramSession(seedData);

    expect(handleMarketingTeamCommand(session, "/trend AI Agent SME", "market-radar").messages.join("\n")).toContain(
      "Market Radar Bot"
    );
    expect(handleMarketingTeamCommand(session, "/post AI Agent SME", "content-creator").messages.join("\n")).toContain(
      "Content Creator Bot"
    );
    expect(handleMarketingTeamCommand(session, "/review AI Agent SME", "performance-brand").messages.join("\n")).toContain(
      "Performance Brand Bot"
    );
    expect(handleMarketingTeamCommand(session, "/post AI Agent SME", "content-creator").messages.join("\n")).toContain(
      "Kết quả có cấu trúc"
    );
  });

  it("keeps content and release actions behind a manager approval gate", () => {
    const session = createTelegramSession(seedData);
    const content = handleMarketingTeamCommand(
      session,
      "/post viet bai Facebook ra mat AI Agent",
      "content-creator"
    );

    expect(content.session.pendingApprovals).toHaveLength(1);
    expect(content.messages.join("\n")).toContain("/approve");

    const runId = content.session.pendingApprovals[0].run_id;
    const approved = handleMarketingTeamCommand(content.session, `/approve ${runId}`, "manager");
    expect(approved.session.pendingApprovals).toHaveLength(0);
    expect(approved.messages.join("\n")).toContain("Đã phê duyệt");
  });

  it("requires a rejection reason and records it as task evidence", () => {
    const session = createTelegramSession(seedData);
    const content = handleMarketingTeamCommand(
      session,
      "/post viet bai Facebook ra mat AI Agent",
      "content-creator"
    );
    const runId = content.session.pendingApprovals[0].run_id;

    const missingReason = handleMarketingTeamCommand(content.session, `/reject ${runId}`, "manager");
    expect(missingReason.session.pendingApprovals).toHaveLength(1);
    expect(missingReason.messages.join("\n")).toContain("lý do");

    const rejected = handleMarketingTeamCommand(
      content.session,
      `/reject ${runId} CTA chưa rõ`,
      "manager"
    );
    const task = rejected.session.data.tasks.find(
      (item) => item.id === content.session.pendingApprovals[0].task_id
    );
    expect(rejected.session.pendingApprovals).toHaveLength(0);
    expect(task?.evidence).toContain("CTA chưa rõ");
  });
});

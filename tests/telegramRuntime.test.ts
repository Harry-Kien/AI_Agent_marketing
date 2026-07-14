import { describe, expect, it } from "vitest";
import {
  buildAgentHandoffContext,
  cleanTelegramText,
  evaluateTelegramAuthorization,
  formatRuntimeHealth
} from "../src/integrations/telegramRuntime";

describe("Telegram runtime helpers", () => {
  it("fails closed when group or operator authorization is missing", () => {
    expect(
      evaluateTelegramAuthorization({}, { chatId: "-1001", userId: "42" })
    ).toEqual({ allowed: false, reason: "missing_configuration" });

    expect(
      evaluateTelegramAuthorization(
        { TELEGRAM_GROUP_ID: "-1001", OPERATOR_TELEGRAM_USER_ID: "42" },
        { chatId: "-1001", userId: "42" }
      )
    ).toEqual({ allowed: true });
  });

  it("rejects a different group or operator", () => {
    const env = {
      TELEGRAM_GROUP_ID: "-1001",
      OPERATOR_TELEGRAM_USER_ID: "42"
    };

    expect(
      evaluateTelegramAuthorization(env, { chatId: "-1002", userId: "42" })
    ).toEqual({ allowed: false, reason: "wrong_group" });
    expect(
      evaluateTelegramAuthorization(env, { chatId: "-1001", userId: "99" })
    ).toEqual({ allowed: false, reason: "wrong_operator" });
  });

  it("cleans raw Markdown while preserving readable Vietnamese output", () => {
    expect(cleanTelegramText("### **Tóm tắt**\n- [ ] Duyệt CTA\n`debug`")).toBe(
      "Tóm tắt\n- Duyệt CTA\ndebug"
    );
  });

  it("builds bounded context for the next specialist department", () => {
    const context = buildAgentHandoffContext([
      { role: "market-radar", output: "Insight khách hàng" },
      { role: "content-creator", output: "Bản nháp nội dung" }
    ]);

    expect(context).toContain("MARKET RADAR");
    expect(context).toContain("Insight khách hàng");
    expect(context).toContain("CONTENT CREATOR");
    expect(context.length).toBeLessThanOrEqual(3600);
  });

  it("formats a health report without exposing bot tokens", () => {
    const report = formatRuntimeHealth({
      botCount: 4,
      aiEnabled: true,
      aiModel: "cx/gpt-5.4-mini",
      groupConfigured: true,
      operatorConfigured: true
    });

    expect(report).toContain("4/4");
    expect(report).toContain("cx/gpt-5.4-mini");
    expect(report).not.toContain("token");
  });
});

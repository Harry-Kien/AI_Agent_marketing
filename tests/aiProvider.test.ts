import { describe, expect, it, vi } from "vitest";
import {
  buildMarketingPrompt,
  createAiProviderConfig,
  generateMarketingAgentOutput
} from "../src/integrations/aiProvider";

describe("9Router/OpenAI-compatible AI provider", () => {
  it("builds provider config from 9Router style environment variables", () => {
    const config = createAiProviderConfig({
      NINE_ROUTER_API_KEY: "secret",
      NINE_ROUTER_BASE_URL: "https://api.9router.com/v1",
      NINE_ROUTER_MODEL: "openai/gpt-4.1-mini"
    });

    expect(config.enabled).toBe(true);
    expect(config.baseUrl).toBe("https://api.9router.com/v1");
    expect(config.model).toBe("openai/gpt-4.1-mini");
  });

  it("falls back to mock mode when no API key is configured", () => {
    const config = createAiProviderConfig({});

    expect(config.enabled).toBe(false);
    expect(config.baseUrl).toBeTruthy();
    expect(config.model).toBeTruthy();
  });

  it("can enable a local 9Router proxy without an API key", () => {
    const config = createAiProviderConfig({
      NINE_ROUTER_ENABLED: "true",
      NINE_ROUTER_BASE_URL: "http://localhost:20128/v1",
      NINE_ROUTER_MODEL: "gpt-4.1-mini"
    });

    expect(config.enabled).toBe(true);
    expect(config.baseUrl).toBe("http://localhost:20128/v1");
    expect(config.apiKey).toBe("");
  });

  it("builds a specialist prompt with role mission, skills, command, and quality gate", () => {
    const prompt = buildMarketingPrompt({
      role: "content-creator",
      command: "post",
      topic: "AI Agent cho SME",
      context: "Campaign launch"
    });

    expect(prompt.system).toContain("Content Strategy & Copy Agent");
    expect(prompt.system).toContain("Bộ kỹ năng");
    expect(prompt.user).toContain("/post");
    expect(prompt.user).toContain("AI Agent cho SME");
    expect(prompt.user).toContain("con người phê duyệt");
    expect(prompt.user).not.toContain("Lark");
  });

  it("keeps creative production and community growth responsibilities separate", () => {
    const creative = buildMarketingPrompt({
      role: "creative-production",
      command: "creative",
      topic: "Bài Facebook AI cho SME"
    });
    const growth = buildMarketingPrompt({
      role: "page-growth",
      command: "community",
      topic: "Phản hồi bình luận khách hàng"
    });

    expect(creative.system).toContain("Creative Production Agent");
    expect(creative.system).toContain("visual brief");
    expect(growth.system).toContain("Page Growth & Community Agent");
    expect(growth.system).toContain("chăm sóc cộng đồng");
    expect(growth.system.toLowerCase()).toContain("không tự đăng");
  });

  it("calls an OpenAI-compatible chat completion endpoint when enabled", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "AI generated specialist output" } }]
      })
    });

    const output = await generateMarketingAgentOutput(
      {
        enabled: true,
        baseUrl: "https://api.9router.com/v1",
        apiKey: "secret",
        model: "openai/gpt-4.1-mini"
      },
      {
        role: "market-radar",
        command: "trend",
        topic: "AI Agent cho doanh nghiep nho",
        context: "Demo"
      },
      fetchMock
    );

    expect(output.mode).toBe("ai");
    expect(output.text).toBe("AI generated specialist output");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.9router.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "Bearer secret" })
      })
    );
  });

  it("omits authorization header when local proxy is enabled without an API key", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Local proxy output" } }]
      })
    });

    await generateMarketingAgentOutput(
      {
        enabled: true,
        baseUrl: "http://localhost:20128/v1",
        apiKey: "",
        model: "gpt-4.1-mini"
      },
      {
        role: "content-creator",
        command: "post",
        topic: "AI Agent cho SME",
        context: "Demo"
      },
      fetchMock
    );

    const [, request] = fetchMock.mock.calls[0];
    expect(request.headers).not.toHaveProperty("authorization");
  });

  it("returns a role-aware mock output when the provider is disabled", async () => {
    const output = await generateMarketingAgentOutput(
      {
        enabled: false,
        baseUrl: "https://api.9router.com/v1",
        apiKey: "",
        model: "openai/gpt-4.1-mini"
      },
      {
        role: "performance-brand",
        command: "review",
        topic: "AI Agent cho SME",
        context: "Demo"
      }
    );

    expect(output.mode).toBe("mock");
    expect(output.text).toContain("Brand & Performance Agent");
    expect(output.text).toContain("AI Agent cho SME");
  });

  it("falls back safely when the enabled provider request fails", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("connection refused"));

    const output = await generateMarketingAgentOutput(
      {
        enabled: true,
        baseUrl: "http://localhost:20128/v1",
        apiKey: "",
        model: "gpt-4.1-mini",
        maxRetries: 0
      },
      {
        role: "market-radar",
        command: "trend",
        topic: "AI Agent cho SME",
        context: "Demo"
      },
      fetchMock
    );

    expect(output.mode).toBe("mock");
    expect(output.fallbackReason).toContain("AI provider unavailable");
    expect(output.text).toContain("Market Radar Bot");
  });

  it("falls back safely when the provider returns an empty response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [] })
    });

    const output = await generateMarketingAgentOutput(
      {
        enabled: true,
        baseUrl: "http://localhost:20128/v1",
        apiKey: "",
        model: "gpt-4.1-mini",
        maxRetries: 0
      },
      {
        role: "content-creator",
        command: "post",
        topic: "AI Agent cho SME"
      },
      fetchMock
    );

    expect(output.mode).toBe("mock");
    expect(output.fallbackReason).toContain("empty response");
  });
});

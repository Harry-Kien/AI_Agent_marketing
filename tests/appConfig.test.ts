// @vitest-environment node
import { describe, expect, it } from "vitest";
import { loadAppConfig, redactSecrets } from "../src/config/appConfig";

describe("loadAppConfig", () => {
  it("dùng giá trị mặc định khi env trống", () => {
    const config = loadAppConfig({});
    expect(config.nodeEnv).toBe("development");
    expect(config.controlApi.port).toBe(8787);
    expect(config.controlApi.host).toBe("127.0.0.1");
    expect(config.warnings).toHaveLength(0);
  });

  it("ép kiểu port và nhận token hợp lệ", () => {
    const config = loadAppConfig({ CONTROL_API_PORT: "9000", CONTROL_API_TOKEN: "a-very-strong-token-123" });
    expect(config.controlApi.port).toBe(9000);
    expect(config.controlApi.token).toBe("a-very-strong-token-123");
  });

  it("fail-fast khi cấu hình sai (port ngoài dải, token quá ngắn)", () => {
    expect(() => loadAppConfig({ CONTROL_API_PORT: "70000" })).toThrow();
    expect(() => loadAppConfig({ CONTROL_API_TOKEN: "ngan" })).toThrow();
  });

  it("cảnh báo khi production không đặt token", () => {
    const config = loadAppConfig({ NODE_ENV: "production" });
    expect(config.warnings.some((w) => w.includes("CONTROL_API_TOKEN"))).toBe(true);
  });
});

describe("redactSecrets", () => {
  it("che trường nhạy cảm, giữ trường thường", () => {
    const redacted = redactSecrets({ token: "abc", name: "kien", nested: { apiKey: "x", ok: 1 } }) as Record<string, unknown>;
    expect(redacted.token).toBe("[đã ẩn]");
    expect(redacted.name).toBe("kien");
    expect((redacted.nested as Record<string, unknown>).apiKey).toBe("[đã ẩn]");
    expect((redacted.nested as Record<string, unknown>).ok).toBe(1);
  });
});

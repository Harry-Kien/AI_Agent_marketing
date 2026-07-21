// @vitest-environment node
import { describe, expect, it } from "vitest";
import { seedData } from "../src/data/seed";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildOfficeReadModel, createControlApi, createRateLimiter, resolveAllowedOrigin } from "../src/integrations/controlApi";
import { createCampaign, createEmptyWorkflowState } from "../src/integrations/marketingWorkflow";
import { createTelegramSession } from "../src/integrations/telegramAdapter";
import { createRuntimeSnapshot } from "../src/integrations/telegramStateStore";

describe("local control API read model", () => {
  it("exposes six agents and a redacted campaign view", () => {
    const workflow = createCampaign(createEmptyWorkflowState(), { brief: "AI cho SME", createdBy: "owner", idSuffix: "API" }).state;
    const model = buildOfficeReadModel(
      createRuntimeSnapshot({ telegramSession: createTelegramSession(seedData), workflow }),
      { MARKETING_APPROVAL_MODE: "enterprise-risk-based" }
    );
    expect(model.agents).toHaveLength(6);
    expect(model.campaignTitle).toBe("AI cho SME");
    expect(model.services.find(({ name }) => name === "Human approval")?.detail).toBe("Final + xuất bản");
    expect(JSON.stringify(model)).not.toContain("TOKEN");
  });

  it("allows any loopback dev origin so the dashboard connects on 5173 or 5174", () => {
    expect(resolveAllowedOrigin("http://127.0.0.1:5173")).toBe("http://127.0.0.1:5173");
    expect(resolveAllowedOrigin("http://localhost:5174")).toBe("http://localhost:5174");
    expect(resolveAllowedOrigin("https://evil.example")).toBe("http://127.0.0.1:5173");
    expect(resolveAllowedOrigin("http://127.0.0.1:5173", "http://127.0.0.1:9000")).toBe("http://127.0.0.1:9000");
  });

  it("routes write actions and answers CORS preflight", async () => {
    const snapshot = createRuntimeSnapshot({ telegramSession: createTelegramSession(seedData), workflow: createEmptyWorkflowState() });
    const calls: string[] = [];
    const api = createControlApi({
      getSnapshot: () => snapshot,
      actions: {
        createCampaign: (brief) => { calls.push(`create:${brief}`); },
        approveActive: () => { calls.push("approve"); },
        rejectActive: (feedback) => { calls.push(`reject:${feedback}`); }
      },
      port: 0
    });
    await api.listen();
    const address = api.server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind.");
    const base = `http://127.0.0.1:${address.port}`;
    try {
      const preflight = await fetch(`${base}/api/campaigns`, { method: "OPTIONS" });
      expect(preflight.status).toBe(204);
      expect(preflight.headers.get("access-control-allow-methods")).toContain("POST");

      const created = await fetch(`${base}/api/campaigns`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brief: "AI cho SME" })
      });
      expect(created.status).toBe(200);
      await fetch(`${base}/api/approvals/active/approve`, { method: "POST" });
      await fetch(`${base}/api/approvals/active/reject`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ feedback: "Sửa CTA" })
      });
      expect(calls).toEqual(["create:AI cho SME", "approve", "reject:Sửa CTA"]);

      const rejectedEmpty = await fetch(`${base}/api/campaigns`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({})
      });
      expect(rejectedEmpty.status).toBe(400);
    } finally {
      api.server.close();
    }
  });

  it("bảo vệ write-path bằng bearer token khi có token", async () => {
    const snapshot = createRuntimeSnapshot({ telegramSession: createTelegramSession(seedData), workflow: createEmptyWorkflowState() });
    let approved = 0;
    const api = createControlApi({
      getSnapshot: () => snapshot,
      token: "a-very-strong-token-123",
      actions: { approveActive: () => { approved += 1; } },
      port: 0
    });
    await api.listen();
    const address = api.server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind.");
    const base = `http://127.0.0.1:${address.port}`;
    try {
      const health = await (await fetch(`${base}/api/health`)).json();
      expect(health.authRequired).toBe(true);

      const noAuth = await fetch(`${base}/api/approvals/active/approve`, { method: "POST" });
      expect(noAuth.status).toBe(401);
      expect(approved).toBe(0);

      const withAuth = await fetch(`${base}/api/approvals/active/approve`, {
        method: "POST",
        headers: { authorization: "Bearer a-very-strong-token-123" }
      });
      expect(withAuth.status).toBe(200);
      expect(approved).toBe(1);
    } finally {
      api.server.close();
    }
  });

  it("createRateLimiter cho qua tới ngưỡng rồi chặn", () => {
    const limiter = createRateLimiter(2, 10_000);
    expect(limiter("ip")).toBe(true);
    expect(limiter("ip")).toBe(true);
    expect(limiter("ip")).toBe(false);
    expect(limiter("other-ip")).toBe(true);
  });

  it("trả 429 khi vượt rate limit write-path", async () => {
    const snapshot = createRuntimeSnapshot({ telegramSession: createTelegramSession(seedData), workflow: createEmptyWorkflowState() });
    const api = createControlApi({
      getSnapshot: () => snapshot,
      actions: { approveActive: () => {} },
      writeRateLimit: { max: 1, windowMs: 10_000 },
      port: 0
    });
    await api.listen();
    const address = api.server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind.");
    const base = `http://127.0.0.1:${address.port}`;
    try {
      expect((await fetch(`${base}/api/approvals/active/approve`, { method: "POST" })).status).toBe(200);
      expect((await fetch(`${base}/api/approvals/active/approve`, { method: "POST" })).status).toBe(429);
    } finally {
      api.server.close();
    }
  });

  it("phục vụ dashboard tĩnh với SPA fallback", async () => {
    const dir = mkdtempSync(join(tmpdir(), "static-"));
    writeFileSync(join(dir, "index.html"), "<!doctype html><title>Dashboard</title>");
    const snapshot = createRuntimeSnapshot({ telegramSession: createTelegramSession(seedData), workflow: createEmptyWorkflowState() });
    const api = createControlApi({ getSnapshot: () => snapshot, staticDir: dir, port: 0 });
    await api.listen();
    const address = api.server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind.");
    const base = `http://127.0.0.1:${address.port}`;
    try {
      const root = await fetch(`${base}/`);
      expect(root.headers.get("content-type")).toContain("text/html");
      expect(await root.text()).toContain("Dashboard");
      const spa = await fetch(`${base}/some/client/route`);
      expect(await spa.text()).toContain("Dashboard");
      // /api vẫn là JSON, không bị nuốt bởi static
      expect((await fetch(`${base}/api/health`)).headers.get("content-type")).toContain("application/json");
    } finally {
      api.server.close();
    }
  });

  it("streams a realtime runtime event over SSE", async () => {
    const snapshot = createRuntimeSnapshot({ telegramSession: createTelegramSession(seedData), workflow: createEmptyWorkflowState() });
    const api = createControlApi({ getSnapshot: () => snapshot, port: 0 });
    await api.listen();
    const address = api.server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind.");
    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/api/events`);
      const reader = response.body?.getReader();
      const first = await reader?.read();
      const text = new TextDecoder().decode(first?.value);
      expect(response.headers.get("content-type")).toContain("text/event-stream");
      expect(text).toContain("event: runtime");
      expect(text).toContain('"agents"');
      await reader?.cancel();
    } finally {
      api.server.close();
    }
  });
});

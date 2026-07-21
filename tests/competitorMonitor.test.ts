// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseCompetitorSnapshot, type CompetitorSnapshot } from "../src/domain/competitorTypes";
import {
  buildCompetitorReadModel,
  defaultCompetitorEvents,
  detectCompetitorChanges,
  mergeCompetitorEvents,
  runCompetitorScan,
  sampleCompetitorBaseline,
  sampleCompetitorLatest
} from "../src/integrations/competitorMonitor";
import { createControlApi } from "../src/integrations/controlApi";
import { seedData } from "../src/data/seed";
import { createTelegramSession } from "../src/integrations/telegramAdapter";
import { createEmptyWorkflowState } from "../src/integrations/marketingWorkflow";
import { createRuntimeSnapshot } from "../src/integrations/telegramStateStore";

const fixedNow = () => "2026-07-21T10:15:00.000Z";

function snapshot(value: string): CompetitorSnapshot {
  return {
    competitorId: "ai-agency-x",
    name: "AI Agency X",
    source: "fixture:pricing-page",
    capturedAt: "2026-07-21T10:00:00.000Z",
    signals: [{ category: "pricing_change", key: "plan:setup-sme", label: "Gói Setup SME", value }]
  };
}

describe("detectCompetitorChanges", () => {
  it("phát hiện đổi giá khi giá trị tín hiệu thay đổi", () => {
    const events = detectCompetitorChanges(snapshot("5.0tr/tháng"), snapshot("4.2tr/tháng"), fixedNow);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("pricing_change");
    expect(events[0].changeKind).toBe("changed");
    expect(events[0].previousValue).toBe("5.0tr/tháng");
    expect(events[0].currentValue).toBe("4.2tr/tháng");
    expect(events[0].impact).toBe("high");
    expect(events[0].detail).toContain("→");
  });

  it("phát hiện tín hiệu mới khi ảnh trước không có key đó", () => {
    const events = detectCompetitorChanges(undefined, snapshot("5.0tr/tháng"), fixedNow);
    expect(events).toHaveLength(1);
    expect(events[0].changeKind).toBe("new");
    expect(events[0].previousValue).toBeUndefined();
  });

  it("không sinh sự kiện khi hai ảnh giống hệt nhau", () => {
    expect(detectCompetitorChanges(snapshot("5.0tr/tháng"), snapshot("5.0tr/tháng"), fixedNow)).toHaveLength(0);
  });

  it("tôn trọng impactHint ghi đè mức mặc định theo loại", () => {
    const current = snapshot("4.2tr/tháng");
    current.signals[0].impactHint = "low";
    expect(detectCompetitorChanges(undefined, current, fixedNow)[0].impact).toBe("low");
  });
});

describe("dedup và scan", () => {
  it("chống cảnh báo trùng: quét lại cùng dữ liệu không tạo sự kiện mới (K04)", () => {
    const first = runCompetitorScan({ previous: sampleCompetitorBaseline, current: sampleCompetitorLatest, now: fixedNow });
    const second = runCompetitorScan({
      previous: sampleCompetitorBaseline,
      current: sampleCompetitorLatest,
      known: first.events,
      now: fixedNow
    });
    expect(first.added.length).toBeGreaterThan(0);
    expect(second.added).toHaveLength(0);
    expect(second.events).toHaveLength(first.events.length);
  });

  it("mergeCompetitorEvents khử trùng theo dedupKey", () => {
    const [event] = detectCompetitorChanges(undefined, snapshot("5.0tr/tháng"), fixedNow);
    const { merged, added } = mergeCompetitorEvents([event], [event]);
    expect(merged).toHaveLength(1);
    expect(added).toHaveLength(0);
  });

  it("sắp xếp sự kiện theo mức ảnh hưởng cao trước", () => {
    const model = buildCompetitorReadModel(defaultCompetitorEvents(fixedNow), { now: fixedNow });
    const impacts = model.alerts.map((alert) => alert.impact);
    const rank = { high: 0, medium: 1, low: 2 } as const;
    const sorted = [...impacts].sort((a, b) => rank[a] - rank[b]);
    expect(impacts).toEqual(sorted);
  });
});

describe("read model redacted", () => {
  it("map đúng shape UI và không lộ dedupKey/confidence/token", () => {
    const model = buildCompetitorReadModel(defaultCompetitorEvents(fixedNow), { now: fixedNow });
    expect(model.connected).toBe(true);
    expect(model.alerts.length).toBeGreaterThan(0);
    const alert = model.alerts[0];
    expect(alert).toHaveProperty("suggestedAction");
    expect(alert).toHaveProperty("time");
    const serialized = JSON.stringify(model);
    expect(serialized).not.toContain("dedupKey");
    expect(serialized).not.toContain("confidence");
    expect(serialized).not.toContain("TOKEN");
  });
});

describe("parse fixture đầu vào", () => {
  it("từ chối snapshot sai schema (failure path)", () => {
    expect(parseCompetitorSnapshot({ competitorId: "" }).success).toBe(false);
    expect(parseCompetitorSnapshot(sampleCompetitorLatest[0]).success).toBe(true);
  });
});

describe("Control API endpoint /api/competitors", () => {
  it("trả về danh sách cảnh báo đối thủ", async () => {
    const runtimeSnapshot = createRuntimeSnapshot({
      telegramSession: createTelegramSession(seedData),
      workflow: createEmptyWorkflowState()
    });
    const api = createControlApi({
      getSnapshot: () => runtimeSnapshot,
      getCompetitorEvents: () => defaultCompetitorEvents(fixedNow),
      port: 0
    });
    await api.listen();
    const address = api.server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind.");
    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/api/competitors`);
      const body = (await response.json()) as { connected: boolean; alerts: Array<{ id: string }> };
      expect(response.status).toBe(200);
      expect(body.connected).toBe(true);
      expect(body.alerts.length).toBeGreaterThan(0);
    } finally {
      api.server.close();
    }
  });
});

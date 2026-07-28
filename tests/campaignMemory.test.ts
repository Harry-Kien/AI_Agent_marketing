// @vitest-environment node
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildAnalyticsReadModel, sampleKpiTarget, sampleMetricSnapshot } from "../src/integrations/campaignAnalytics";
import {
  appendCampaignMemory,
  buildCampaignMemory,
  buildMemoryReadModel,
  formatMemoriesForPrompt,
  loadCampaignMemories,
  retrieveMemories
} from "../src/integrations/campaignMemory";

const fixedNow = () => "2026-07-22T10:00:00.000Z";
const analytics = buildAnalyticsReadModel({ actual: sampleMetricSnapshot, target: sampleKpiTarget, now: fixedNow });

function memoryFor(campaignId: string, brief: string) {
  return buildCampaignMemory({ campaignId, brief, analytics }, fixedNow);
}

describe("buildCampaignMemory", () => {
  it("rút bài học, điều cần tránh và tag từ chiến dịch đã đo", () => {
    const memory = memoryFor("CMP-1", "Chiến dịch AI Agent cho phần mềm kế toán SME thu lead");
    expect(memory.lessons.length).toBeGreaterThan(0);
    expect(memory.avoid.some((item) => item.includes("lead") || item.includes("conversion"))).toBe(true);
    expect(memory.tags).toContain("agent");
    expect(memory.overallAttainment).toBe(analytics.overallAttainment);
  });
});

describe("retrieveMemories", () => {
  it("tìm chiến dịch trước liên quan theo chủ đề", () => {
    const memories = [
      memoryFor("CMP-A", "Chiến dịch phần mềm kế toán AI cho SME"),
      memoryFor("CMP-B", "Chiến dịch mỹ phẩm thiên nhiên cho phái đẹp")
    ];
    const hits = retrieveMemories(memories, "phần mềm kế toán cho doanh nghiệp", 1);
    expect(hits[0].memory.campaignId).toBe("CMP-A");
  });

  it("format prompt chứa nhãn ký ức", () => {
    const hits = retrieveMemories([memoryFor("CMP-A", "phần mềm kế toán AI SME")], "kế toán", 1);
    expect(formatMemoriesForPrompt(hits)).toContain("KÝ ỨC TỪ CHIẾN DỊCH TRƯỚC");
  });
});

describe("store bền qua phiên", () => {
  it("append rồi load lại được, khử trùng theo id", () => {
    const path = join(mkdtempSync(join(tmpdir(), "mem-")), "campaign-memory.json");
    appendCampaignMemory(path, memoryFor("CMP-1", "chiến dịch A"));
    appendCampaignMemory(path, memoryFor("CMP-1", "chiến dịch A cập nhật"));
    appendCampaignMemory(path, memoryFor("CMP-2", "chiến dịch B"));
    const loaded = loadCampaignMemories(path);
    expect(loaded).toHaveLength(2);
  });

  it("load rỗng khi chưa có file", () => {
    expect(loadCampaignMemories("/khong/ton/tai.json")).toHaveLength(0);
  });
});

describe("buildMemoryReadModel", () => {
  it("đếm và tóm tắt ký ức", () => {
    const model = buildMemoryReadModel([memoryFor("CMP-1", "phần mềm kế toán AI SME")], fixedNow);
    expect(model.count).toBe(1);
    expect(model.memories[0].campaignId).toBe("CMP-1");
    expect(model.memories[0].brief.length).toBeLessThanOrEqual(100);
  });
});

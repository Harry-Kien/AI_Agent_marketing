import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  parseCampaignMemoryStore,
  type CampaignMemory,
  type CampaignMemoryHit
} from "../domain/memoryTypes";
import type { AnalyticsReadModel } from "../domain/analyticsTypes";
import { embedOne, embedTexts, type EmbeddingConfig } from "./embeddingProvider";
import { hybridRetrieve } from "./semanticRetrieval";

type FetchLike = typeof fetch;
const nowIso = () => new Date().toISOString();

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

function memoryText(memory: CampaignMemory): string {
  return `${memory.brief} ${memory.lessons.join(" ")} ${memory.tags.join(" ")}`;
}

const stopwords = new Set(["chiến", "dịch", "cho", "và", "của", "một", "các", "trong", "với", "để", "là", "có"]);

// Rút vài từ khóa chính từ brief làm tag.
function deriveTags(brief: string, max = 6): string[] {
  const counts = new Map<string, number>();
  for (const token of tokenize(brief)) {
    if (token.length < 3 || stopwords.has(token)) continue;
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([term]) => term);
}

// Tạo ký ức từ một chiến dịch đã đo lường (gắn với Learning Package/analytics — F12).
export function buildCampaignMemory(
  input: { campaignId: string; brief: string; analytics: AnalyticsReadModel },
  now: () => string = nowIso
): CampaignMemory {
  const { analytics } = input;
  const avoid = analytics.kpis
    .filter((kpi) => kpi.status === "below")
    .map((kpi) => `Chỉ số ${kpi.metric} dễ hụt mục tiêu — cần tối ưu sớm.`);
  return {
    id: `MEM-${input.campaignId}`,
    campaignId: input.campaignId,
    brief: input.brief,
    overallAttainment: analytics.overallAttainment,
    topAngles: analytics.recommendedActions.slice(0, 5),
    lessons: analytics.lessons.slice(0, 5),
    avoid,
    tags: deriveTags(input.brief),
    createdAt: now()
  };
}

// Retrieval từ vựng qua brief + lessons + tags của các chiến dịch trước.
export function retrieveMemories(memories: CampaignMemory[], query: string, k = 2): CampaignMemoryHit[] {
  const queryTerms = new Set(tokenize(query));
  if (queryTerms.size === 0 || memories.length === 0) return [];

  const total = memories.length;
  const docs = memories.map((memory) => tokenize(`${memory.brief} ${memory.lessons.join(" ")} ${memory.tags.join(" ")}`));
  const documentFrequency = new Map<string, number>();
  for (const tokens of docs) {
    for (const term of new Set(tokens)) documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
  }

  return memories
    .map((memory, index) => {
      const tokens = docs[index];
      let score = 0;
      for (const term of queryTerms) {
        const termFrequency = tokens.filter((token) => token === term).length;
        if (termFrequency === 0) continue;
        const idf = Math.log((total + 1) / ((documentFrequency.get(term) ?? 0) + 0.5));
        score += idf * (termFrequency / (termFrequency + 1.5));
      }
      return { memory, score: Math.round(score * 1000) / 1000 };
    })
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

// Nhúng toàn bộ ký ức một lần (hybrid recall); embedding tắt → undefined[] → fallback BM25.
export async function embedMemories(
  memories: CampaignMemory[],
  config: EmbeddingConfig,
  fetchImpl: FetchLike = fetch
): Promise<Array<number[] | undefined>> {
  const vectors = await embedTexts(config, memories.map(memoryText), fetchImpl);
  return vectors ?? memories.map(() => undefined);
}

// Recall "thông minh": hybrid (dense + BM25) khi có embedding; suy biến BM25 khi chưa cắm key.
export async function retrieveMemoriesSmart(
  memories: CampaignMemory[],
  query: string,
  options: { config: EmbeddingConfig; embeddings?: Array<number[] | undefined>; k?: number; fetchImpl?: FetchLike }
): Promise<CampaignMemoryHit[]> {
  const k = options.k ?? 2;
  const hasEmbeddings = Boolean(options.embeddings?.some((vector) => vector && vector.length > 0));
  const queryEmbedding = hasEmbeddings ? await embedOne(options.config, query, options.fetchImpl ?? fetch) : null;
  const docs = memories.map((memory, index) => ({ text: memoryText(memory), embedding: options.embeddings?.[index] }));
  return hybridRetrieve(docs, query, queryEmbedding, k).map((hit) => ({ memory: memories[hit.index], score: hit.score }));
}

export function formatMemoriesForPrompt(hits: CampaignMemoryHit[]): string {
  if (hits.length === 0) return "";
  const lines = hits.flatMap((hit) => [
    `- Chiến dịch trước (đạt ${Math.round(hit.memory.overallAttainment * 100)}% KPI): ${hit.memory.brief.slice(0, 100)}`,
    ...hit.memory.lessons.slice(0, 2).map((lesson) => `  · Bài học: ${lesson}`),
    ...hit.memory.avoid.slice(0, 1).map((item) => `  · Tránh: ${item}`)
  ]);
  return ["KÝ ỨC TỪ CHIẾN DỊCH TRƯỚC (rút kinh nghiệm, đừng lặp lại lỗi cũ):", ...lines].join("\n");
}

// Read model đã redacted cho dashboard: đếm + tóm tắt, không lộ toàn văn.
export function buildMemoryReadModel(memories: CampaignMemory[], now: () => string = nowIso) {
  return {
    connected: true,
    generatedAt: now(),
    count: memories.length,
    memories: [...memories]
      .slice(-20)
      .reverse()
      .map((memory) => ({
        campaignId: memory.campaignId,
        brief: memory.brief.slice(0, 100),
        overallAttainment: memory.overallAttainment,
        lessons: memory.lessons.slice(0, 3),
        tags: memory.tags,
        createdAt: memory.createdAt
      }))
  };
}

// Store bền qua phiên (file JSON), giữ tối đa 500 ký ức gần nhất.
export function loadCampaignMemories(path: string): CampaignMemory[] {
  if (!existsSync(path)) return [];
  try {
    const parsed = parseCampaignMemoryStore(JSON.parse(readFileSync(path, "utf8")));
    return parsed.success ? parsed.data.memories : [];
  } catch {
    return [];
  }
}

// Ghi thêm/ cập nhật một ký ức (khử trùng theo id), lưu file.
export function appendCampaignMemory(path: string, memory: CampaignMemory): CampaignMemory[] {
  const existing = loadCampaignMemories(path).filter((item) => item.id !== memory.id);
  const next = [...existing, memory].slice(-500);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ memories: next }, null, 2)}\n`, "utf8");
  return next;
}

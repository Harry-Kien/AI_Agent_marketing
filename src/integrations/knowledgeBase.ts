import { existsSync, readFileSync } from "node:fs";
import {
  parseBrandKnowledgeBase,
  type BrandKnowledgeBase,
  type KnowledgeChunk,
  type KnowledgeHit
} from "../domain/knowledgeTypes";
import { embedOne, embedTexts, type EmbeddingConfig } from "./embeddingProvider";
import { hybridRetrieve } from "./semanticRetrieval";

type FetchLike = typeof fetch;

// Tách token, giữ chữ có dấu tiếng Việt (\p{L}) và số (\p{N}).
function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

// Retrieval từ vựng (BM25-lite, xác định, không cần embedding/API). Khi cắm embedding thật
// chỉ cần thay hàm này, interface giữ nguyên. Trả top-k chunk liên quan nhất.
export function retrieveKnowledge(kb: BrandKnowledgeBase, query: string, k = 3): KnowledgeHit[] {
  const queryTerms = new Set(tokenize(query));
  if (queryTerms.size === 0 || kb.chunks.length === 0) return [];

  const total = kb.chunks.length;
  const chunkTokens = kb.chunks.map((chunk) => tokenize(`${chunk.title} ${chunk.content} ${chunk.tags.join(" ")}`));
  const documentFrequency = new Map<string, number>();
  for (const tokens of chunkTokens) {
    for (const term of new Set(tokens)) documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
  }

  const scored = kb.chunks.map((chunk, index) => {
    const tokens = chunkTokens[index];
    let score = 0;
    for (const term of queryTerms) {
      const termFrequency = tokens.filter((token) => token === term).length;
      if (termFrequency === 0) continue;
      const idf = Math.log((total + 1) / ((documentFrequency.get(term) ?? 0) + 0.5));
      score += idf * (termFrequency / (termFrequency + 1.5)); // bão hòa TF kiểu BM25
    }
    return { chunk, score: Math.round(score * 1000) / 1000 };
  });

  return scored
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

function chunkText(chunk: KnowledgeChunk): string {
  return `${chunk.title} ${chunk.content} ${chunk.tags.join(" ")}`;
}

// Nhúng toàn bộ chunk MỘT LẦN (cache lúc khởi động). Trả undefined[] nếu embedding tắt → fallback BM25.
export async function embedKnowledgeBase(
  kb: BrandKnowledgeBase,
  config: EmbeddingConfig,
  fetchImpl: FetchLike = fetch
): Promise<Array<number[] | undefined>> {
  const vectors = await embedTexts(config, kb.chunks.map(chunkText), fetchImpl);
  return vectors ?? kb.chunks.map(() => undefined);
}

// Retrieval "thông minh": hybrid (dense + BM25) khi có embedding; suy biến BM25 khi chưa cắm key.
export async function retrieveKnowledgeSmart(
  kb: BrandKnowledgeBase,
  query: string,
  options: { config: EmbeddingConfig; embeddings?: Array<number[] | undefined>; k?: number; fetchImpl?: FetchLike }
): Promise<KnowledgeHit[]> {
  const k = options.k ?? 3;
  const hasEmbeddings = Boolean(options.embeddings?.some((vector) => vector && vector.length > 0));
  const queryEmbedding = hasEmbeddings ? await embedOne(options.config, query, options.fetchImpl ?? fetch) : null;
  const docs = kb.chunks.map((chunk, index) => ({
    text: chunkText(chunk),
    embedding: options.embeddings?.[index]
  }));
  return hybridRetrieve(docs, query, queryEmbedding, k).map((hit) => ({
    chunk: kb.chunks[hit.index],
    score: hit.score
  }));
}

// Định dạng tri thức thành khối căn cứ để chèn vào prompt của agent.
export function formatKnowledgeForPrompt(hits: KnowledgeHit[]): string {
  if (hits.length === 0) return "";
  const lines = hits.map((hit) => `- ${hit.chunk.title}: ${hit.chunk.content}`);
  return ["CĂN CỨ THƯƠNG HIỆU (dùng làm nguồn, KHÔNG bịa thêm số liệu ngoài danh sách này):", ...lines].join("\n");
}

// Nạp knowledge base từ file JSON của doanh nghiệp; nếu không có/không hợp lệ dùng bản mẫu.
export function loadBrandKnowledge(path?: string): BrandKnowledgeBase {
  if (path && existsSync(path)) {
    try {
      const parsed = parseBrandKnowledgeBase(JSON.parse(readFileSync(path, "utf8")));
      if (parsed.success) return parsed.data;
    } catch {
      /* rơi về bản mẫu bên dưới */
    }
  }
  return sampleBrandKnowledge;
}

const sampleChunks: KnowledgeChunk[] = [
  {
    id: "pricing-setup-sme",
    title: "Giá gói thiết lập AI Agent cho SME",
    content: "Gói thiết lập hệ thống 6 AI Agent cho doanh nghiệp SME: 4.900.000đ trọn gói một lần, đã gồm cấu hình và đào tạo. Không phí ẩn.",
    tags: ["giá", "gói", "sme", "setup"]
  },
  {
    id: "policy-vat",
    title: "Chính sách hóa đơn VAT",
    content: "Hỗ trợ xuất hóa đơn VAT đầy đủ cho doanh nghiệp. Thời gian xuất hóa đơn trong 3 ngày làm việc.",
    tags: ["vat", "hóa đơn", "chính sách"]
  },
  {
    id: "onboarding-time",
    title: "Thời gian triển khai",
    content: "Triển khai trung bình 3-5 ngày làm việc, có chuyên viên đồng hành từng bước và bàn giao tài liệu vận hành.",
    tags: ["triển khai", "onboarding", "thời gian"]
  },
  {
    id: "differentiator",
    title: "Điểm khác biệt cạnh tranh",
    content: "Khác biệt: vận hành human-in-the-loop, mọi bài đăng đều được người duyệt trước khi lên Facebook; không tự chi tiền, không spam.",
    tags: ["khác biệt", "an toàn", "human-in-the-loop"]
  },
  {
    id: "brand-tone",
    title: "Tông giọng thương hiệu",
    content: "Chuyên nghiệp, thực tế, không phóng đại, không cam kết con số doanh thu tuyệt đối. Ưu tiên giá trị và bằng chứng.",
    tags: ["tone", "thương hiệu", "brand"]
  }
];

export const sampleBrandKnowledge: BrandKnowledgeBase = {
  name: "AI Marketing Command Center (mẫu)",
  chunks: sampleChunks
};

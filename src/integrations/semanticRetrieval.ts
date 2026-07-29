// Hybrid retrieval chuẩn ngành 2026: hợp nhất Dense (embedding) + Sparse (BM25) bằng
// Reciprocal Rank Fusion (RRF). Thuần, xác định, test được với vector giả.

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

// Điểm BM25-lite cho từng doc theo truy vấn (aligned theo index doc).
export function lexicalScores(docTexts: string[], query: string): number[] {
  const queryTerms = new Set(tokenize(query));
  if (queryTerms.size === 0) return docTexts.map(() => 0);
  const total = docTexts.length;
  const docTokens = docTexts.map(tokenize);
  const documentFrequency = new Map<string, number>();
  for (const tokens of docTokens) {
    for (const term of new Set(tokens)) documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
  }
  return docTokens.map((tokens) => {
    let score = 0;
    for (const term of queryTerms) {
      const tf = tokens.filter((token) => token === term).length;
      if (tf === 0) continue;
      const idf = Math.log((total + 1) / ((documentFrequency.get(term) ?? 0) + 0.5));
      score += idf * (tf / (tf + 1.5));
    }
    return score;
  });
}

// Điểm dense qua cosine giữa embedding doc và query.
export function denseScores(docEmbeddings: Array<number[] | undefined>, queryEmbedding: number[] | null): number[] {
  if (!queryEmbedding) return docEmbeddings.map(() => 0);
  return docEmbeddings.map((embedding) => (embedding ? cosineSimilarity(embedding, queryEmbedding) : 0));
}

// Xếp hạng theo điểm giảm dần → trả vị trí (rank 1-based) cho từng index doc.
function ranksFromScores(scores: number[]): number[] {
  const order = scores.map((score, index) => ({ index, score })).sort((a, b) => b.score - a.score);
  const rank = new Array<number>(scores.length).fill(scores.length + 1);
  order.forEach((item, position) => {
    if (item.score > 0) rank[item.index] = position + 1;
  });
  return rank;
}

// Reciprocal Rank Fusion: điểm = tổng 1/(k + rank) qua các bảng xếp hạng.
export function reciprocalRankFusion(scoreArrays: number[][], k = 60): number[] {
  const length = scoreArrays[0]?.length ?? 0;
  const fused = new Array<number>(length).fill(0);
  for (const scores of scoreArrays) {
    const ranks = ranksFromScores(scores);
    for (let i = 0; i < length; i += 1) {
      if (ranks[i] <= length) fused[i] += 1 / (k + ranks[i]);
    }
  }
  return fused;
}

export interface HybridDoc {
  text: string;
  embedding?: number[];
}

export interface HybridHit {
  index: number;
  score: number;
}

// Retrieve hybrid. Có queryEmbedding + doc có embedding → fuse dense+lexical (RRF).
// Không có embedding → suy biến về lexical thuần (giữ hành vi BM25 hiện tại, lọc score>0).
export function hybridRetrieve(
  docs: HybridDoc[],
  query: string,
  queryEmbedding: number[] | null,
  topK = 3
): HybridHit[] {
  if (docs.length === 0) return [];
  const lexical = lexicalScores(docs.map((doc) => doc.text), query);
  const hasDense = Boolean(queryEmbedding) && docs.some((doc) => doc.embedding && doc.embedding.length > 0);

  if (!hasDense) {
    return lexical
      .map((score, index) => ({ index, score: Math.round(score * 1000) / 1000 }))
      .filter((hit) => hit.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  const dense = denseScores(docs.map((doc) => doc.embedding), queryEmbedding);
  const fused = reciprocalRankFusion([lexical, dense]);
  return fused
    .map((score, index) => ({ index, score: Math.round(score * 100000) / 100000 }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

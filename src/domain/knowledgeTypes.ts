import { z } from "zod";

// Một mẩu tri thức thương hiệu (sản phẩm, giá, chính sách, tone...) để agent tra cứu.
export const knowledgeChunkSchema = z.strictObject({
  id: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(4000),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([])
});
export type KnowledgeChunk = z.infer<typeof knowledgeChunkSchema>;

export const brandKnowledgeBaseSchema = z.strictObject({
  name: z.string().trim().min(1).max(160),
  chunks: z.array(knowledgeChunkSchema).max(2000)
});
export type BrandKnowledgeBase = z.infer<typeof brandKnowledgeBaseSchema>;

export interface KnowledgeHit {
  chunk: KnowledgeChunk;
  score: number;
}

export function parseBrandKnowledgeBase(value: unknown) {
  return brandKnowledgeBaseSchema.safeParse(value);
}

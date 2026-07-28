import { z } from "zod";

// Ký ức dài hạn của một chiến dịch đã hoàn tất — để agent học từ lịch sử (chuẩn "memory" 2026).
export const campaignMemorySchema = z.strictObject({
  id: z.string().trim().min(1).max(80),
  campaignId: z.string().trim().min(1).max(80),
  brief: z.string().trim().min(1).max(2000),
  overallAttainment: z.number().min(0).max(5),
  topAngles: z.array(z.string().trim().min(1).max(400)).max(10),
  lessons: z.array(z.string().trim().min(1).max(400)).max(10),
  avoid: z.array(z.string().trim().min(1).max(400)).max(10),
  tags: z.array(z.string().trim().min(1).max(40)).max(20),
  createdAt: z.string().trim().min(1).max(40)
});
export type CampaignMemory = z.infer<typeof campaignMemorySchema>;

export const campaignMemoryStoreSchema = z.strictObject({
  memories: z.array(campaignMemorySchema).max(500)
});
export type CampaignMemoryStore = z.infer<typeof campaignMemoryStoreSchema>;

export interface CampaignMemoryHit {
  memory: CampaignMemory;
  score: number;
}

export function parseCampaignMemoryStore(value: unknown) {
  return campaignMemoryStoreSchema.safeParse(value);
}

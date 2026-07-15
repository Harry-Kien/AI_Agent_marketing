import { z } from "zod";

export const agentWorkProductSchema = z.strictObject({
  summary: z.string().trim().min(20).max(500),
  deliverables: z.array(z.string().trim().min(4).max(300)).min(2).max(8),
  checks: z.array(z.string().trim().min(4).max(300)).min(1).max(8),
  risks: z.array(z.string().trim().min(4).max(300)).min(1).max(6),
  evidence: z.array(z.string().trim().min(4).max(300)).min(1).max(8),
  recommendation: z.enum(["approve", "approve_with_conditions", "revise", "reject"]),
  approval_question: z.string().trim().min(10).max(300),
  quality_score: z.number().int().min(60).max(100)
});

export type AgentWorkProduct = z.infer<typeof agentWorkProductSchema>;

export function parseAgentWorkProduct(raw: string) {
  try {
    const normalized = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    return agentWorkProductSchema.safeParse(JSON.parse(normalized));
  } catch {
    return agentWorkProductSchema.safeParse(undefined);
  }
}

export function formatAgentWorkProduct(product: AgentWorkProduct) {
  const bullets = (items: string[]) => items.map((item) => `- ${item}`);
  return [
    `TÓM TẮT\n${product.summary}`,
    `DELIVERABLES\n${bullets(product.deliverables).join("\n")}`,
    `KIỂM TRA\n${bullets(product.checks).join("\n")}`,
    `BẰNG CHỨNG\n${bullets(product.evidence).join("\n")}`,
    `RỦI RO\n${bullets(product.risks).join("\n")}`,
    `KHUYẾN NGHỊ: ${product.recommendation}`,
    `ĐIỂM CHẤT LƯỢNG: ${product.quality_score}/100`,
    `CHỜ QUYẾT ĐỊNH\n${product.approval_question}`
  ].join("\n\n");
}

/**
 * Demo Golden Sequence — chạy full luồng 6 agent + 5 module năng lực ở chế độ mock.
 * Không cần API key, không gọi Meta thật. Dùng để trình diễn trước hội đồng:
 *   npm run demo:golden
 */
import { generateMarketingAgentOutput } from "../src/integrations/aiProvider";
import { resolveManagerIntent } from "../src/integrations/managerIntent";
import {
  approveRun,
  completePublication,
  completeRun,
  confirmPublication,
  createCampaign,
  createEmptyWorkflowState,
  requestPublicationConfirmation
} from "../src/integrations/marketingWorkflow";
import { defaultCompetitorEvents, buildCompetitorReadModel } from "../src/integrations/competitorMonitor";
import { buildMarketResearchReadModel, sampleMarketSignals } from "../src/integrations/marketResearch";
import { createVideoJob, generateVideoJob, createVideoProviderConfig, sampleVideoRequest } from "../src/integrations/videoGenerationAdapter";
import { buildAnalyticsReadModel, sampleKpiTarget, sampleMetricSnapshot } from "../src/integrations/campaignAnalytics";
import { buildCommunityReadModel, sampleApprovedFaqs, sampleCommunityMessages } from "../src/integrations/communityInbox";

const mockAiConfig = { enabled: false, baseUrl: "local", apiKey: "", model: "mock" } as const;
const stageRoleLabel: Record<string, string> = {
  research: "Market Radar",
  content: "Content Creator",
  creative: "Strategy & Creative",
  brand: "Brand & Performance",
  final: "Marketing Manager"
};

function line(char = "─") {
  console.log(char.repeat(72));
}
function step(n: number, title: string) {
  line();
  console.log(`BƯỚC ${n}. ${title}`);
  line();
}

async function main() {
  const brief =
    "Hãy tạo chiến dịch Facebook 7 ngày giới thiệu giải pháp AI Agent cho doanh nghiệp SME 5-30 nhân sự. Mục tiêu là thu lead tư vấn. Không dùng tuyên bố phóng đại.";

  step(1, "Admin gửi yêu cầu tiếng Việt → nhận diện ý định");
  const intent = await resolveManagerIntent(brief, { pendingRunIds: [] });
  console.log(`Ý định nhận diện : ${intent.intent}`);
  console.log(`Brief rút ra     : ${(intent.brief ?? brief).slice(0, 80)}...`);

  step(2, "Manager tạo Campaign + Research Run");
  let state = createCampaign(createEmptyWorkflowState(), {
    brief: intent.brief ?? brief,
    createdBy: "operator",
    idSuffix: "DEMO"
  }).state;
  const campaignId = state.campaigns[0].id;
  console.log(`Campaign ID      : ${campaignId}`);
  console.log(`Stage khởi tạo   : ${state.campaigns[0].stage}`);

  step(3, "Sáu agent tự bàn giao qua 5 cổng (mock AI, có quality gate)");
  const stages = ["research", "content", "creative", "brand", "final"] as const;
  let finalPublicationContent = "";
  for (const stage of stages) {
    const run = state.runs.find((item) => item.status === "running" && item.stage === stage)!;
    const output = await generateMarketingAgentOutput(mockAiConfig, {
      role: run.role,
      command: stage === "final" ? "finalize" : stage,
      topic: state.campaigns[0].brief,
      context: run.input
    });
    state = completeRun(state, run.id, output.text, undefined, {
      publicationContent: stage === "final" ? output.product.publication_content : undefined
    }).state;
    state = approveRun(state, run.id, "operator").state;
    if (stage === "final") finalPublicationContent = output.product.publication_content ?? "";
    console.log(
      `  ✓ ${stageRoleLabel[stage].padEnd(22)} | mode=${output.mode.padEnd(4)} | score=${output.product.quality_score} | ${output.product.recommendation}`
    );
  }
  console.log(`Stage sau 5 cổng : ${state.campaigns[0].stage}`);

  step(4, "Final Package → Preview → Xác nhận đăng (guarded, không gọi Meta thật)");
  console.log("NỘI DUNG XUẤT BẢN (preview):");
  console.log(`  "${finalPublicationContent.replace(/\n/g, " ").slice(0, 140)}..."`);
  state = requestPublicationConfirmation(state, campaignId, "operator").state;
  console.log(`Sau yêu cầu xác nhận : ${state.campaigns[0].stage}`);
  state = confirmPublication(state, campaignId, "operator").state;
  state = completePublication(state, campaignId, { postId: "page_post_demo" }).state;
  console.log(`Trạng thái cuối      : ${state.campaigns[0].stage}`);
  console.log(`Bằng chứng đăng      : postId=${state.campaigns[0].publicationEvidence?.postId}`);

  step(5, "F03 — Competitor Monitor (diff + chống trùng)");
  const competitorEvents = defaultCompetitorEvents();
  const competitors = buildCompetitorReadModel(competitorEvents);
  for (const alert of competitors.alerts) {
    console.log(`  [${alert.impact.toUpperCase().padEnd(6)}] ${alert.name}: ${alert.detail}`);
  }

  step(6, "F02 — Market Research (insight có nguồn + độ tin cậy, hút cả tín hiệu đối thủ)");
  const research = buildMarketResearchReadModel({
    campaignId,
    brief: state.campaigns[0].brief,
    signals: sampleMarketSignals,
    competitorEvents
  });
  for (const insight of research.insights.slice(0, 4)) {
    console.log(`  (${insight.sourceType}/${(insight.confidence * 100).toFixed(0)}%) ${insight.statement.slice(0, 70)}`);
  }

  step(7, "F06 — Video Generation (guarded, mock fallback có contract tương đương)");
  const videoJob = await generateVideoJob(createVideoProviderConfig(process.env), {
    ...sampleVideoRequest,
    campaignId
  });
  console.log(`  Job ${videoJob.id.slice(0, 32)}... | mode=${videoJob.mode} | status=${videoJob.status}`);
  console.log(`  Assets: ${videoJob.assets.map((a) => `${a.type}:${a.status}`).join(", ")}`);
  void createVideoJob;

  step(8, "F11/F12 — Analytics + Learning Package");
  const analytics = buildAnalyticsReadModel({ actual: sampleMetricSnapshot, target: sampleKpiTarget });
  console.log(`  Overall attainment: ${(analytics.overallAttainment * 100).toFixed(0)}%`);
  for (const kpi of analytics.kpis) {
    console.log(`    ${kpi.metric.padEnd(12)} ${kpi.actual}/${kpi.target} → ${kpi.status}`);
  }
  console.log(`  Bài học: ${analytics.lessons[0]}`);
  console.log(`  Giả thuyết chiến dịch tiếp: ${analytics.nextCampaignHypothesis}`);

  step(9, "F10 — Community Inbox (phân loại + che PII)");
  const community = buildCommunityReadModel(sampleCommunityMessages, { faqs: sampleApprovedFaqs });
  for (const msg of community.messages) {
    console.log(`  [${msg.priority.toUpperCase().padEnd(6)}] ${msg.category.padEnd(9)} lead=${msg.leadScore} → ${msg.action}`);
    console.log(`           "${msg.redactedText.slice(0, 60)}"`);
  }

  step(10, "Kiểm chứng nhất quán");
  const auditCount = state.auditEvents.length;
  const consistent =
    state.campaigns[0].stage === "published" &&
    research.campaignId === campaignId &&
    videoJob.campaignId === campaignId &&
    analytics.campaignId === "CMP-DEMO-AI-SME"; // fixture KPI dùng campaign demo cố định
  console.log(`  Audit events     : ${auditCount}`);
  console.log(`  Campaign xuyên suốt: ${campaignId}`);
  console.log(`  Kết quả          : ${consistent ? "✅ NHẤT QUÁN — luồng chạy trọn vẹn" : "⚠️  CẦN KIỂM TRA"}`);
  line("═");
  console.log("DEMO GOLDEN SEQUENCE HOÀN TẤT — toàn bộ chạy ở chế độ mock, không gọi dịch vụ ngoài.");
  line("═");

  if (!consistent) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

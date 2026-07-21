export interface OfficeAgent {
  id: string;
  name: string;
  department: string;
  state: "working" | "waiting_approval" | "available" | "offline";
  task: string;
  latency: string;
}

export interface OfficeSnapshot {
  connected: boolean;
  campaignId: string;
  campaignTitle: string;
  stage: string;
  approvals: number;
  agents: OfficeAgent[];
  activity: Array<{ id: string; time: string; actor: string; message: string }>;
  services: Array<{ name: string; state: "online" | "guarded" | "offline"; detail: string }>;
}

// Read model đã redacted phơi qua Control API (khớp backend controlApi.ts).
export interface CompetitorAlertView {
  id: string;
  name: string;
  type: "pricing_change" | "new_campaign" | "feature_release" | "ad_push";
  detail: string;
  impact: "high" | "medium" | "low";
  time: string;
  suggestedAction: string;
}

export interface MarketInsightView {
  id: string;
  category: "trend" | "pain_point" | "audience" | "opportunity";
  statement: string;
  sourceType: "brief" | "observed_market" | "competitor" | "assumption";
  confidence: number;
  mediaAngle: string;
}

export interface MarketResearchView {
  connected: boolean;
  campaignId: string;
  topAngles: string[];
  insights: MarketInsightView[];
}

export interface VideoAssetView {
  type: "image" | "video" | "audio" | "subtitle" | "storyboard";
  status: "queued" | "processing" | "ready" | "failed";
  provider: string;
  ready: boolean;
}

export interface VideoStudioView {
  connected: boolean;
  campaignId: string;
  jobId: string;
  status: "queued" | "processing" | "ready" | "failed";
  mode: "provider" | "mock";
  title: string;
  durationSeconds: number;
  assets: VideoAssetView[];
}

export interface KpiComparisonView {
  metric: string;
  actual: number;
  target: number;
  attainment: number;
  status: "above" | "on_track" | "below";
}

export interface AnalyticsView {
  connected: boolean;
  campaignId: string;
  kpis: KpiComparisonView[];
  overallAttainment: number;
  lessons: string[];
  recommendedActions: string[];
  nextCampaignHypothesis: string;
}

export interface TriagedMessageView {
  id: string;
  channel: "comment" | "inbox";
  category: "lead" | "faq" | "complaint" | "spam" | "general";
  priority: "high" | "medium" | "low" | "ignore";
  leadScore: number;
  action: "auto_reply" | "draft_for_approval" | "escalate";
  reason: string;
  suggestedReply?: string;
  redactedText: string;
  createdAt: string;
}

export interface CommunityView {
  connected: boolean;
  escalations: number;
  messages: TriagedMessageView[];
}

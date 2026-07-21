import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import type { TelegramRuntimeSnapshot } from "./telegramStateStore";
import type { CompetitorChangeEvent } from "../domain/competitorTypes";
import { buildCompetitorReadModel, defaultCompetitorEvents } from "./competitorMonitor";
import { buildMarketResearchReadModel, sampleMarketSignals } from "./marketResearch";
import {
  buildVideoStudioReadModel,
  createVideoProviderConfig,
  generateVideoJob,
  sampleVideoRequest
} from "./videoGenerationAdapter";
import { buildAnalyticsReadModel, sampleKpiTarget, sampleMetricSnapshot } from "./campaignAnalytics";
import { buildCommunityReadModel, sampleApprovedFaqs, sampleCommunityMessages } from "./communityInbox";

const agentRoster = [
  ["manager", "AI Marketing Manager", "Điều phối & phê duyệt"],
  ["market-radar", "Market Intelligence", "Nghiên cứu thị trường"],
  ["content-creator", "Content Creator", "Copywriting & nội dung"],
  ["creative-production", "Content Strategy & Creative", "Chiến lược & sáng tạo"],
  ["performance-brand", "Brand & Performance", "Kiểm định & KPI"],
  ["page-growth", "Page Growth & Community", "Page & CSKH"]
] as const;

export function buildOfficeReadModel(
  snapshot: TelegramRuntimeSnapshot,
  env: Record<string, string | undefined> = process.env
) {
  const campaign = snapshot.workflow.campaigns[snapshot.workflow.campaigns.length - 1];
  const activeRun = snapshot.workflow.runs.find((run) => run.id === campaign?.activeRunId);
  const pending = snapshot.workflow.runs.filter((run) => run.status === "pending_approval");
  return {
    connected: true,
    campaignId: campaign?.id ?? "CHƯA CÓ CHIẾN DỊCH",
    campaignTitle: campaign?.brief ?? "Hãy nhắn mục tiêu mới cho Manager Bot",
    stage: campaign?.stage ?? "intake",
    approvals: pending.length,
    agents: agentRoster.map(([id, name, department]) => {
      const roleRuns = snapshot.workflow.runs.filter((run) => run.role === id);
      const agentRun = roleRuns[roleRuns.length - 1];
      const isActive = activeRun?.role === id;
      return {
        id, name, department,
        state: isActive ? (activeRun.status === "pending_approval" ? "waiting_approval" : "working") : "available",
        task: isActive ? `${activeRun.stage}: ${campaign?.brief}` : agentRun ? `${agentRun.stage} package: ${agentRun.status}` : "Sẵn sàng nhận nhiệm vụ",
        latency: isActive ? "đang xử lý" : "-"
      };
    }),
    activity: snapshot.workflow.auditEvents.slice(-12).reverse().map((event) => ({
      id: event.id,
      time: new Date(event.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
      actor: event.actorId,
      message: event.summary
    })),
    services: [
      { name: "Telegram", state: "online", detail: "6 vai trò Agent" },
      { name: "9Router", state: "online", detail: "AI gateway" },
      { name: "Meta Page", state: env.META_PUBLISH_ENABLED === "true" ? "online" : "guarded", detail: env.META_PUBLISH_ENABLED === "true" ? "Được phép xuất bản" : "Đăng đang khóa" },
      {
        name: "Human approval",
        state: "online",
        detail: env.MARKETING_APPROVAL_MODE === "strict-stage-gate" ? "Mỗi stage + xuất bản" : "Final + xuất bản"
      }
    ]
  };
}

// Hành động ghi (write-path) do tầng runtime (script/telegram-bot) hiện thực; API chỉ điều phối.
export interface ControlApiActions {
  createCampaign?: (brief: string) => Promise<void> | void;
  approveActive?: () => Promise<void> | void;
  rejectActive?: (feedback: string) => Promise<void> | void;
  requestPublication?: () => Promise<void> | void;
  confirmPublication?: () => Promise<void> | void;
}

export function createControlApi(options: {
  getSnapshot: () => TelegramRuntimeSnapshot;
  getCompetitorEvents?: () => CompetitorChangeEvent[];
  actions?: ControlApiActions;
  token?: string;
  staticDir?: string;
  writeRateLimit?: { max: number; windowMs: number };
  env?: Record<string, string | undefined>;
  host?: string;
  port?: number;
}) {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 8787;
  const env = options.env ?? process.env;
  const token = options.token;
  const staticDir = options.staticDir && existsSync(options.staticDir) ? options.staticDir : undefined;
  const rateLimit = options.writeRateLimit ?? { max: 60, windowMs: 10_000 };
  const limiter = createRateLimiter(rateLimit.max, rateLimit.windowMs);
  const isAuthorized = (request: IncomingMessage): boolean =>
    !token || request.headers.authorization === `Bearer ${token}`;
  const getCompetitorEvents = options.getCompetitorEvents ?? (() => defaultCompetitorEvents());
  const eventClients = new Set<ServerResponse>();
  const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
    const allowOrigin = resolveAllowedOrigin(request.headers.origin, env.CONTROL_API_ALLOW_ORIGIN);
    response.setHeader("access-control-allow-origin", allowOrigin);
    response.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
    response.setHeader("access-control-allow-headers", "content-type, authorization");
    response.setHeader("x-content-type-options", "nosniff");
    response.setHeader("x-frame-options", "SAMEORIGIN");
    response.setHeader("referrer-policy", "no-referrer");
    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }
    if (request.method === "GET" && request.url === "/api/events") {
      response.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "access-control-allow-origin": allowOrigin
      });
      eventClients.add(response);
      writeEvent(response, buildOfficeReadModel(options.getSnapshot()));
      request.on("close", () => eventClients.delete(response));
      return;
    }
    response.setHeader("content-type", "application/json; charset=utf-8");
    if (request.method === "GET" && request.url === "/api/health") return send(response, 200, { ok: true, service: "marketing-control-api", authRequired: Boolean(token) });
    if (request.method === "GET" && request.url === "/api/runtime") return send(response, 200, buildOfficeReadModel(options.getSnapshot()));
    if (request.method === "GET" && request.url === "/api/competitors") return send(response, 200, buildCompetitorReadModel(getCompetitorEvents()));
    if (request.method === "GET" && request.url === "/api/market-research") {
      const snapshot = options.getSnapshot();
      const campaign = snapshot.workflow.campaigns[snapshot.workflow.campaigns.length - 1];
      return send(
        response,
        200,
        buildMarketResearchReadModel({
          campaignId: campaign?.id ?? "CMP-DEMO",
          brief: campaign?.brief ?? "Chưa có brief chiến dịch.",
          signals: sampleMarketSignals,
          competitorEvents: getCompetitorEvents()
        })
      );
    }
    if (request.method === "GET" && request.url === "/api/video-studio") {
      const snapshot = options.getSnapshot();
      const campaign = snapshot.workflow.campaigns[snapshot.workflow.campaigns.length - 1];
      const videoRequest = {
        ...sampleVideoRequest,
        campaignId: campaign?.id ?? sampleVideoRequest.campaignId,
        title: campaign?.brief ? `Video 30s: ${campaign.brief}` : sampleVideoRequest.title
      };
      const job = await generateVideoJob(createVideoProviderConfig(env), videoRequest);
      return send(response, 200, buildVideoStudioReadModel(job));
    }
    if (request.method === "GET" && request.url === "/api/analytics") {
      return send(response, 200, buildAnalyticsReadModel({ actual: sampleMetricSnapshot, target: sampleKpiTarget }));
    }
    if (request.method === "GET" && request.url === "/api/community") {
      return send(
        response,
        200,
        buildCommunityReadModel(sampleCommunityMessages, {
          faqs: sampleApprovedFaqs,
          autoReplyEnabled: env.META_AUTO_REPLY_ENABLED === "true"
        })
      );
    }
    if (request.method === "POST" && request.url?.startsWith("/api/")) {
      const actions = options.actions;
      if (!actions) return send(response, 501, { error: "actions_not_supported" });
      if (!isAuthorized(request)) return send(response, 401, { error: "unauthorized" });
      const clientKey = request.socket.remoteAddress ?? "unknown";
      if (!limiter(clientKey)) return send(response, 429, { error: "rate_limited" });
      try {
        if (request.url === "/api/campaigns") {
          const body = await readJsonBody(request);
          const brief = typeof body.brief === "string" ? body.brief.trim() : "";
          if (!brief) return send(response, 400, { error: "brief_required" });
          await actions.createCampaign?.(brief);
          return send(response, 200, buildOfficeReadModel(options.getSnapshot()));
        }
        if (request.url === "/api/approvals/active/approve") {
          await actions.approveActive?.();
          return send(response, 200, buildOfficeReadModel(options.getSnapshot()));
        }
        if (request.url === "/api/approvals/active/reject" || request.url === "/api/runs/active/revise") {
          const body = await readJsonBody(request);
          await actions.rejectActive?.(typeof body.feedback === "string" ? body.feedback : "");
          return send(response, 200, buildOfficeReadModel(options.getSnapshot()));
        }
        if (request.url === "/api/publication/request") {
          await actions.requestPublication?.();
          return send(response, 200, buildOfficeReadModel(options.getSnapshot()));
        }
        if (request.url === "/api/publication/confirm") {
          await actions.confirmPublication?.();
          return send(response, 200, buildOfficeReadModel(options.getSnapshot()));
        }
      } catch (error) {
        return send(response, 409, { error: error instanceof Error ? error.message : "action_failed" });
      }
    }
    if (request.method === "GET" && staticDir && !request.url?.startsWith("/api/")) {
      return serveStatic(response, staticDir, request.url ?? "/");
    }
    return send(response, 404, { error: "not_found" });
  });
  const broadcast = (snapshot: TelegramRuntimeSnapshot) => {
    const payload = buildOfficeReadModel(snapshot);
    for (const client of eventClients) writeEvent(client, payload);
  };
  return { server, host, port, broadcast, listen: () => new Promise<void>((resolve) => server.listen(port, host, resolve)) };
}

// Control API chỉ chạy local; cho phép mọi origin loopback (127.0.0.1/localhost, cổng bất kỳ)
// để dashboard chạy trên cổng dev nào cũng nối được. Có thể ghim cứng qua CONTROL_API_ALLOW_ORIGIN.
const loopbackOrigin = /^http:\/\/(127\.0\.0\.1|localhost):\d+$/;
export function resolveAllowedOrigin(requestOrigin: string | undefined, override?: string): string {
  if (override) return override;
  if (requestOrigin && loopbackOrigin.test(requestOrigin)) return requestOrigin;
  return "http://127.0.0.1:5173";
}

// Rate limiter cửa sổ trượt trong bộ nhớ, theo IP. Trả false khi vượt ngưỡng.
export function createRateLimiter(max: number, windowMs: number): (key: string) => boolean {
  const hits = new Map<string, number[]>();
  return (key: string) => {
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((time) => now - time < windowMs);
    if (recent.length >= max) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    return true;
  };
}

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2"
};

// Phục vụ file tĩnh của dashboard đã build; fallback về index.html cho SPA routing.
async function serveStatic(response: ServerResponse, root: string, url: string) {
  const cleanPath = normalize(decodeURIComponent(url.split("?")[0])).replace(/^(\.\.[/\\])+/, "");
  let filePath = join(root, cleanPath);
  if (!filePath.startsWith(root)) filePath = join(root, "index.html");
  if (!existsSync(filePath) || extname(filePath) === "") filePath = join(root, "index.html");
  try {
    const file = await readFile(filePath);
    response.setHeader("content-type", contentTypes[extname(filePath)] ?? "application/octet-stream");
    response.statusCode = 200;
    response.end(file);
  } catch {
    send(response, 404, { error: "not_found" });
  }
}

function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let data = "";
    request.on("data", (chunk) => {
      data += chunk;
      if (data.length > 100_000) data = data.slice(0, 100_000);
    });
    request.on("end", () => {
      try {
        resolve(data ? (JSON.parse(data) as Record<string, unknown>) : {});
      } catch {
        resolve({});
      }
    });
    request.on("error", () => resolve({}));
  });
}

function send(response: ServerResponse, status: number, payload: unknown) {
  response.statusCode = status;
  response.end(JSON.stringify(payload));
}

function writeEvent(response: ServerResponse, payload: unknown) {
  response.write(`event: runtime\ndata: ${JSON.stringify(payload)}\n\n`);
}

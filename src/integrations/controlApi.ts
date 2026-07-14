import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { TelegramRuntimeSnapshot } from "./telegramStateStore";

const agentRoster = [
  ["manager", "AI Marketing Manager", "Điều phối & phê duyệt"],
  ["market-radar", "Market Intelligence", "Nghiên cứu thị trường"],
  ["content-creator", "Content Strategy & Copy", "Chiến lược nội dung"],
  ["creative-production", "Creative Production", "Sản xuất sáng tạo"],
  ["performance-brand", "Brand & Performance", "Kiểm định & KPI"],
  ["page-growth", "Page Growth & Community", "Page & CSKH"]
] as const;

export function buildOfficeReadModel(snapshot: TelegramRuntimeSnapshot) {
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
      { name: "Telegram", state: "online", detail: "6 danh tính Agent" },
      { name: "9Router", state: "online", detail: "AI gateway" },
      { name: "Meta Page", state: process.env.META_PUBLISH_ENABLED === "true" ? "online" : "guarded", detail: process.env.META_PUBLISH_ENABLED === "true" ? "Được phép xuất bản" : "Đăng đang khóa" },
      { name: "Human approval", state: "online", detail: "Bắt buộc" }
    ]
  };
}

export function createControlApi(options: { getSnapshot: () => TelegramRuntimeSnapshot; host?: string; port?: number }) {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 8787;
  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    response.setHeader("access-control-allow-origin", "http://127.0.0.1:5174");
    response.setHeader("content-type", "application/json; charset=utf-8");
    if (request.method === "GET" && request.url === "/api/health") return send(response, 200, { ok: true, service: "marketing-control-api" });
    if (request.method === "GET" && request.url === "/api/runtime") return send(response, 200, buildOfficeReadModel(options.getSnapshot()));
    return send(response, 404, { error: "not_found" });
  });
  return { server, host, port, listen: () => new Promise<void>((resolve) => server.listen(port, host, resolve)) };
}

function send(response: ServerResponse, status: number, payload: unknown) {
  response.statusCode = status;
  response.end(JSON.stringify(payload));
}

import type { OfficeSnapshot } from "./types";

export const officeFallback: OfficeSnapshot = {
  connected: false,
  campaignId: "CMP-DEMO-AI-SME",
  campaignTitle: "Ứng dụng AI Agent cho doanh nghiệp SME",
  stage: "creative_pending_approval",
  approvals: 1,
  agents: [
    { id: "manager", name: "AI Marketing Manager", department: "Điều phối & phê duyệt", state: "working", task: "Tổng hợp campaign brief", latency: "1.2s" },
    { id: "radar", name: "Market Intelligence", department: "Nghiên cứu thị trường", state: "available", task: "Insight đã bàn giao", latency: "3.8s" },
    { id: "copy", name: "Content Creator", department: "Copywriting & nội dung", state: "available", task: "Content package đã duyệt", latency: "4.5s" },
    { id: "creative", name: "Content Strategy & Creative", department: "Chiến lược & sáng tạo", state: "waiting_approval", task: "Visual brief đang chờ duyệt", latency: "5.1s" },
    { id: "brand", name: "Brand & Performance", department: "Kiểm định & KPI", state: "available", task: "Chờ creative package", latency: "-" },
    { id: "growth", name: "Page Growth & Community", department: "Page & CSKH", state: "available", task: "Chờ final package", latency: "-" }
  ],
  activity: [
    { id: "1", time: "10:31", actor: "Market Intelligence", message: "Bàn giao insight khách hàng SME cho Content Strategy." },
    { id: "2", time: "10:34", actor: "Bạn", message: "Đã duyệt content package RUN-DEMO-CNT-1." },
    { id: "3", time: "10:35", actor: "Content Strategy & Creative", message: "Đang soạn visual brief và asset checklist." }
  ],
  services: [
    { name: "Telegram", state: "online", detail: "6 danh tính Agent" },
    { name: "9Router", state: "online", detail: "OpenAI-compatible" },
    { name: "Meta Page", state: "guarded", detail: "Đọc được, đăng đang khóa" },
    { name: "Human approval", state: "online", detail: "Bắt buộc tại 6 cổng" }
  ]
};

export async function loadOfficeSnapshot(): Promise<OfficeSnapshot> {
  try {
    const response = await fetch("http://127.0.0.1:8787/api/runtime", { signal: AbortSignal.timeout(1800) });
    if (!response.ok) throw new Error("offline");
    return { ...(await response.json() as OfficeSnapshot), connected: true };
  } catch {
    return officeFallback;
  }
}

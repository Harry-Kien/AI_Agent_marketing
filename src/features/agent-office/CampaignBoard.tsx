import { useState } from "react";
import { 
  ClipboardList, Clock, Eye, User, Sparkles, CheckCircle2, 
  HelpCircle, ChevronRight, X, ShieldAlert 
} from "lucide-react";
import type { OfficeSnapshot } from "./types";

interface CampaignBoardProps {
  snapshot: OfficeSnapshot;
}

interface MockCampaign {
  id: string;
  title: string;
  creator: string;
  date: string;
  stage: string;
  sla: string;
  progress: number; // percentage
  metrics?: { impressions: string; clicks: string; leads: number };
  workProducts?: {
    research?: string;
    content?: string;
    creative?: string;
    brand?: string;
  };
}

export function CampaignBoard({ snapshot }: CampaignBoardProps) {
  const [selectedCampaign, setSelectedCampaign] = useState<MockCampaign | null>(null);

  // Define the 7 columns of the Stage-Gate pipeline
  const columns = [
    { id: "intake", label: "Tiếp nhận brief", color: "var(--line)" },
    { id: "research", label: "Nghiên cứu", color: "var(--violet)" },
    { id: "content", label: "Nội dung", color: "var(--blue)" },
    { id: "creative", label: "Sáng tạo visual", color: "var(--teal)" },
    { id: "brand", label: "Kiểm định", color: "var(--amber)" },
    { id: "final", label: "Tổng hợp", color: "var(--green)" },
    { id: "publish", label: "Xuất bản", color: "var(--blue)" }
  ];

  // List of campaigns in the pipeline
  const campaigns: MockCampaign[] = [
    // Previously published campaigns
    {
      id: "CMP-20260714-X87B",
      title: "Khóa học AI thực chiến cho SME",
      creator: "Admin (Telegram)",
      date: "14/07/2026",
      stage: "publish",
      sla: "Hoàn thành trong 4m 12s",
      progress: 100,
      metrics: { impressions: "12,450", clicks: "842", leads: 48 },
      workProducts: {
        research: "Phân tích ICP: Chủ doanh nghiệp SME từ 25-45 tuổi, đau đầu vì chi phí marketing.",
        content: "Draft: Học AI để không bị bỏ lại phía sau. Giảm 80% thời gian lên content quảng cáo.",
        creative: "Image Prompt: A busy shop owner smiling while looking at a smartphone showcasing smart marketing metrics.",
        brand: "Passed. No risky keywords found."
      }
    },
    {
      id: "CMP-20260710-P43Z",
      title: "Giới thiệu giải pháp Automation Marketing",
      creator: "Bảo (Dashboard)",
      date: "10/07/2026",
      stage: "publish",
      sla: "Hoàn thành trong 3m 50s",
      progress: 100,
      metrics: { impressions: "8,920", clicks: "410", leads: 22 },
      workProducts: {
        research: "Phân tích ICP: Trưởng phòng marketing các công ty startups công nghệ.",
        content: "Draft: Tự động hóa 90% phễu thu thập leads chỉ với 1 Click chuột.",
        creative: "Image Prompt: 3D render of a futuristic gears system glowing in neon teal, tech startup vibe.",
        brand: "Passed. Verified brand logo colors."
      }
    }
  ];

  // Map snapshot state to active campaign
  const activeStageId = columns.find(col => snapshot.stage.toLowerCase().includes(col.id))?.id || "intake";

  const activeCampaign: MockCampaign = {
    id: snapshot.campaignId,
    title: snapshot.campaignTitle,
    creator: "Admin (Telegram)",
    date: new Date().toLocaleDateString("vi-VN"),
    stage: activeStageId,
    sla: "Hạn mức SLA: 5m 00s",
    progress: Math.min(
      95,
      Math.max(
        10,
        (columns.findIndex(c => c.id === activeStageId) + 1) * 14
      )
    ),
    workProducts: {
      research: activeStageId !== "intake" ? "ICP: Các doanh nghiệp bán lẻ nhỏ lẻ muốn ứng dụng AI để tối ưu hóa bài đăng xã hội." : undefined,
      content: ["content", "creative", "brand", "final", "publish"].includes(activeStageId) 
        ? "Facebook Post: Đột phá doanh thu với trợ lý viết content AI. X3 nội dung sản xuất mỗi ngày!" 
        : undefined,
      creative: ["creative", "brand", "final", "publish"].includes(activeStageId)
        ? "Image prompt: Co-working space filled with smiling young entrepreneurs, holographic AI assistant hovering, ultra detailed."
        : undefined,
      brand: ["brand", "final", "publish"].includes(activeStageId)
        ? "Compliance Check: Approved. Verified Facebook Ad policies guidelines."
        : undefined
    }
  };

  // Combine campaigns
  const allCampaigns = [activeCampaign, ...campaigns];

  return (
    <div style={{ display: "grid", gap: "1.2rem" }}>
      <section className="panel" style={{ padding: "1.2rem" }}>
        <div className="panel-title" style={{ justifyContent: "space-between", marginBottom: "1.2rem" }}>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <ClipboardList size={20} style={{ color: "var(--blue)" }} />
            <h2>Bảng điều hành Chiến dịch (7 Stage-Gate Kanban)</h2>
          </div>
          <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
            Kéo thả tự động điều hành bởi Manager Bot
          </span>
        </div>

        <div 
          className="kanban" 
          style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(7, minmax(130px, 1fr))", 
            gap: "0.75rem", 
            overflowX: "auto",
            paddingBottom: "1rem"
          }}
        >
          {columns.map((col) => {
            const colCampaigns = allCampaigns.filter(c => c.stage === col.id);
            const isActiveCol = activeStageId === col.id;

            return (
              <div 
                className="kanban-column" 
                key={col.id} 
                style={{ 
                  background: isActiveCol ? "#f8fafc" : "#fafbfc",
                  border: isActiveCol ? "1.5px solid var(--blue)" : "1px solid var(--line)",
                  borderRadius: "8px",
                  padding: "0.6rem",
                  display: "flex",
                  flexDirection: "column",
                  minHeight: "340px",
                  position: "relative"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.6rem" }}>
                  <h3 style={{ fontSize: "0.76rem", margin: 0, color: isActiveCol ? "var(--ink)" : "var(--muted)" }}>
                    {col.label}
                  </h3>
                  <span className={`badge ${isActiveCol ? "high" : "muted"}`} style={{ fontSize: "0.62rem" }}>
                    {colCampaigns.length}
                  </span>
                </div>

                <div style={{ display: "grid", gap: "0.5rem", flex: 1 }}>
                  {colCampaigns.map((camp) => {
                    const isActiveCard = camp.id === snapshot.campaignId;
                    return (
                      <article 
                        className="task-card" 
                        key={camp.id}
                        onClick={() => setSelectedCampaign(camp)}
                        style={{ 
                          borderLeft: `3px solid ${col.color}`,
                          padding: "0.6rem",
                          background: "#fff",
                          border: "1px solid var(--line)",
                          borderRadius: "6px",
                          boxShadow: isActiveCard ? "0 4px 6px -1px rgba(59, 130, 246, 0.1)" : "none",
                          cursor: "pointer",
                          transition: "transform 0.15s ease",
                          transform: isActiveCard ? "scale(1.01)" : "none"
                        }}
                      >
                        {isActiveCard && (
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                            <span className="badge ready" style={{ fontSize: "0.58rem" }}>RUNNING</span>
                            <Sparkles size={11} style={{ color: "var(--teal)" }} />
                          </div>
                        )}
                        <h4 style={{ margin: "0.2rem 0", fontSize: "0.8rem", lineHeight: "1.3" }}>
                          {camp.title}
                        </h4>
                        
                        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", margin: "0.35rem 0", fontSize: "0.68rem", color: "var(--muted)" }}>
                          <Clock size={11} />
                          <span>{camp.sla}</span>
                        </div>

                        {isActiveCard && (
                          <div style={{ marginTop: "0.4rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.62rem", color: "var(--muted)", marginBottom: "0.15rem" }}>
                              <span>Tiến độ Stage</span>
                              <span>{camp.progress}%</span>
                            </div>
                            <div style={{ height: "4px", background: "#f1f5f9", borderRadius: "2px", overflow: "hidden" }}>
                              <div style={{ width: `${camp.progress}%`, height: "100%", background: "var(--blue)" }} />
                            </div>
                          </div>
                        )}

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem", borderTop: "1px solid #f8fafc", paddingTop: "0.3rem" }}>
                          <span style={{ fontSize: "0.62rem", color: "var(--muted)" }}>{camp.creator}</span>
                          <span style={{ display: "flex", alignItems: "center", fontSize: "0.68rem", color: "var(--blue)", fontWeight: "bold" }}>
                            Xem chi tiết <ChevronRight size={10} />
                          </span>
                        </div>
                      </article>
                    );
                  })}
                  {colCampaigns.length === 0 && (
                    <div style={{ display: "grid", placeItems: "center", flex: 1, border: "1px dashed var(--line)", borderRadius: "6px", color: "var(--muted)", fontSize: "0.65rem", padding: "1rem 0" }}>
                      Trống
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Campaign Details Inspector Drawer/Panel */}
      {selectedCampaign && (
        <div 
          style={{ 
            position: "fixed", 
            top: 0, 
            right: 0, 
            bottom: 0, 
            width: "480px", 
            background: "#fff", 
            boxShadow: "-10px 0 30px rgba(0, 0, 0, 0.15)",
            zIndex: 100, 
            padding: "1.5rem", 
            display: "flex", 
            flexDirection: "column",
            borderLeft: "1px solid var(--line)"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem" }}>
            <div>
              <span className="badge high" style={{ fontSize: "0.68rem" }}>
                {selectedCampaign.id}
              </span>
              <h3 style={{ margin: "0.2rem 0 0", fontSize: "1.1rem" }}>{selectedCampaign.title}</h3>
            </div>
            <button 
              onClick={() => setSelectedCampaign(null)} 
              style={{ background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer", padding: "0.25rem" }}
            >
              <X size={20} />
            </button>
          </div>

          <div style={{ display: "grid", gap: "1rem", flex: 1, overflowY: "auto", paddingRight: "0.25rem" }}>
            <div style={{ background: "#f8fafc", padding: "0.75rem", borderRadius: "6px", border: "1px solid var(--line)" }}>
              <strong style={{ display: "block", fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.4rem" }}>
                THÔNG TIN CHUNG
              </strong>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.8rem" }}>
                <div>Người tạo: <strong>{selectedCampaign.creator}</strong></div>
                <div>Ngày lập: <strong>{selectedCampaign.date}</strong></div>
                <div>Trạng thái: <strong style={{ color: "var(--blue)" }}>{statusLabel(selectedCampaign.stage).toUpperCase()}</strong></div>
                <div>Thời gian chạy: <strong>{selectedCampaign.sla}</strong></div>
              </div>
            </div>

            {selectedCampaign.metrics && (
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "0.75rem", borderRadius: "6px" }}>
                <strong style={{ display: "block", fontSize: "0.75rem", color: "var(--green)", marginBottom: "0.4rem" }}>
                  ĐO LƯỜNG HIỆU QUẢ (KPIs)
                </strong>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", fontSize: "0.8rem", textAlign: "center" }}>
                  <div style={{ background: "#fff", padding: "0.4rem", borderRadius: "4px" }}>
                    <span style={{ fontSize: "0.65rem", color: "var(--muted)", display: "block" }}>Lượt tiếp cận</span>
                    <strong>{selectedCampaign.metrics.impressions}</strong>
                  </div>
                  <div style={{ background: "#fff", padding: "0.4rem", borderRadius: "4px" }}>
                    <span style={{ fontSize: "0.65rem", color: "var(--muted)", display: "block" }}>Lượt click</span>
                    <strong>{selectedCampaign.metrics.clicks}</strong>
                  </div>
                  <div style={{ background: "#fff", padding: "0.4rem", borderRadius: "4px" }}>
                    <span style={{ fontSize: "0.65rem", color: "var(--muted)", display: "block" }}>Lead thu về</span>
                    <strong style={{ color: "var(--green)" }}>{selectedCampaign.metrics.leads}</strong>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: "grid", gap: "0.75rem" }}>
              <strong style={{ display: "block", fontSize: "0.75rem", color: "var(--muted)" }}>
                HỒ SƠ TÀI LIỆU CÁC AGENT (WORK PRODUCTS)
              </strong>
              
              <div style={{ borderLeft: "3px solid var(--violet)", paddingLeft: "0.65rem", fontSize: "0.8rem" }}>
                <strong style={{ display: "block", color: "var(--violet)", fontSize: "0.72rem" }}>Market Intelligence Agent</strong>
                <p style={{ margin: "0.15rem 0 0", color: "var(--ink)", fontStyle: "italic" }}>
                  {selectedCampaign.workProducts?.research || "Đang nghiên cứu thị trường..."}
                </p>
              </div>

              <div style={{ borderLeft: "3px solid var(--blue)", paddingLeft: "0.65rem", fontSize: "0.8rem" }}>
                <strong style={{ display: "block", color: "var(--blue)", fontSize: "0.72rem" }}>Content Creator Agent</strong>
                <p style={{ margin: "0.15rem 0 0", color: "var(--ink)", fontStyle: "italic" }}>
                  {selectedCampaign.workProducts?.content || "Đang chờ insight nghiên cứu..."}
                </p>
              </div>

              <div style={{ borderLeft: "3px solid var(--teal)", paddingLeft: "0.65rem", fontSize: "0.8rem" }}>
                <strong style={{ display: "block", color: "var(--teal)", fontSize: "0.72rem" }}>Creative Director Agent</strong>
                <p style={{ margin: "0.15rem 0 0", color: "var(--ink)", fontStyle: "italic" }}>
                  {selectedCampaign.workProducts?.creative || "Đang chờ content draft..."}
                </p>
              </div>

              <div style={{ borderLeft: "3px solid var(--amber)", paddingLeft: "0.65rem", fontSize: "0.8rem" }}>
                <strong style={{ display: "block", color: "var(--amber)", fontSize: "0.72rem" }}>Brand Guardian Agent</strong>
                <p style={{ margin: "0.15rem 0 0", color: "var(--ink)", fontStyle: "italic" }}>
                  {selectedCampaign.workProducts?.brand || "Đang chờ creative asset..."}
                </p>
              </div>
            </div>
          </div>

          <div style={{ marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid var(--line)", display: "flex", gap: "0.5rem" }}>
            <button 
              onClick={() => setSelectedCampaign(null)} 
              style={{ flex: 1, padding: "0.5rem", fontSize: "0.85rem" }}
            >
              Đóng Inspector
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

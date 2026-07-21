import { useEffect, useState } from "react";
import { Search, AlertTriangle, TrendingUp, Send, Check, ShieldAlert, Sparkles, RefreshCw } from "lucide-react";
import { loadCompetitors, loadMarketResearch } from "./api";
import type { MarketInsightView } from "./types";

interface CompetitorAlert {
  id: string;
  name: string;
  type: "pricing_change" | "new_campaign" | "feature_release" | "ad_push";
  detail: string;
  impact: "high" | "medium" | "low";
  time: string;
  suggestedAction: string;
  proposed?: boolean;
}

export function CompetitorList() {
  const [alerts, setAlerts] = useState<CompetitorAlert[]>([
    {
      id: "comp-1",
      name: "AI Agency X",
      type: "pricing_change",
      detail: "Ra mắt gói thiết lập AI Agent marketing trọn gói cho SME giảm 15% (chỉ còn 4.2tr/tháng).",
      impact: "high",
      time: "10:15",
      suggestedAction: "Chạy chiến dịch nhấn mạnh ưu thế 'Không phí ẩn' và tích hợp trực tiếp Meta Page của chúng ta."
    },
    {
      id: "comp-2",
      name: "Học viện Marketing Y",
      type: "new_campaign",
      detail: "Bắt đầu chuỗi webinar đào tạo 'ChatGPT & AI Automation trong HR và Admin' miễn phí để lấy leads.",
      impact: "medium",
      time: "Hôm qua",
      suggestedAction: "Tạo lead-magnet tài liệu 'Cheat sheet 100+ prompt Marketing chuyên sâu' để cạnh tranh lưu lượng."
    },
    {
      id: "comp-3",
      name: "SaaS Ops Việt Nam",
      type: "feature_release",
      detail: "Cập nhật tính năng Auto-reply comment trên Tiktok và Facebook Graph API v18.",
      impact: "low",
      time: "3 ngày trước",
      suggestedAction: "Cập nhật tài liệu kỹ thuật để so sánh tính năng phân tích cảm xúc vượt trội của chúng ta."
    },
    {
      id: "comp-4",
      name: "MarTech Core",
      type: "ad_push",
      detail: "Tăng 40% ngân sách quảng cáo Facebook nhắm vào các từ khóa 'Tự động hóa Content', 'AI viết bài'.",
      impact: "high",
      time: "5 ngày trước",
      suggestedAction: "Tối ưu hóa điểm chất lượng SEO bài viết content pillar để giữ vững top search tự nhiên."
    }
  ]);

  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [insights, setInsights] = useState<MarketInsightView[]>([]);

  useEffect(() => {
    let active = true;
    loadCompetitors().then((data) => {
      if (!active || !data) return;
      setConnected(Boolean(data.connected));
      if (data.alerts?.length) setAlerts(data.alerts.map((alert) => ({ ...alert, proposed: false })));
    });
    loadMarketResearch().then((data) => {
      if (!active || !data) return;
      setInsights(data.insights.slice(0, 5));
    });
    return () => {
      active = false;
    };
  }, []);

  const handlePropose = async (id: string) => {
    setLoadingId(id);
    // Simulate API call proposing this competitor action as a research seed
    await new Promise((resolve) => setTimeout(resolve, 800));
    setAlerts((prev) =>
      prev.map((item) => (item.id === id ? { ...item, proposed: true } : item))
    );
    setLoadingId(null);
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case "pricing_change": return "Thay đổi giá bán";
      case "new_campaign": return "Chiến dịch mới";
      case "feature_release": return "Tính năng mới";
      case "ad_push": return "Tăng QC/Ads";
      default: return type;
    }
  };

  const getImpactBadge = (impact: "high" | "medium" | "low") => {
    switch (impact) {
      case "high": return <span className="badge urgent">Cao (High Risk)</span>;
      case "medium": return <span className="badge high">Trung bình</span>;
      case "low": return <span className="badge spec">Thấp</span>;
    }
  };

  return (
    <div className="view-grid">
      <div className="split">
        {/* Left Side: Real-time Alert Feed */}
        <section className="panel" style={{ flex: 1.3 }}>
          <div className="panel-title" style={{ marginBottom: "1rem", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Search size={18} style={{ color: "var(--violet)" }} />
              <h2>Giám sát Đối thủ Cạnh tranh (Competitor Monitor)</h2>
            </div>
            <span className={`badge ${connected ? "ready" : "muted"}`} style={{ fontSize: "0.62rem" }}>
              {connected ? "● Realtime" : "○ Dữ liệu mẫu"}
            </span>
          </div>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "1.2rem" }}>
            Market Intelligence Agent liên tục quét các kênh truyền thông xã hội, thư viện quảng cáo và web đối thủ để phát hiện các thay đổi chiến lược.
          </p>

          <div style={{ display: "grid", gap: "0.85rem" }}>
            {alerts.map((item) => (
              <div 
                key={item.id} 
                style={{ 
                  border: item.proposed ? "1px solid var(--green)" : "1px solid var(--line)", 
                  padding: "0.85rem", 
                  borderRadius: "8px",
                  background: item.proposed ? "#f0faf5" : "#fff",
                  transition: "all 0.2s ease"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <strong style={{ fontSize: "0.9rem" }}>{item.name}</strong>
                    <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>• {item.time}</span>
                  </div>
                  <div style={{ display: "flex", gap: "0.35rem" }}>
                    <span className="badge ready" style={{ fontSize: "0.65rem" }}>{getTypeName(item.type).toUpperCase()}</span>
                    {getImpactBadge(item.impact)}
                  </div>
                </div>

                <p style={{ margin: "0.4rem 0", fontSize: "0.82rem", color: "var(--ink)", lineHeight: "1.4" }}>
                  {item.detail}
                </p>

                <div style={{ marginTop: "0.6rem", background: "#f8fafc", padding: "0.6rem", borderRadius: "5px", fontSize: "0.78rem" }}>
                  <span style={{ color: "var(--blue)", fontWeight: "bold", display: "block", fontSize: "0.7rem", marginBottom: "0.15rem" }}>
                    ĐỀ XUẤT PHẢN KHỎI (AI SUGGESTION):
                  </span>
                  "{item.suggestedAction}"
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.75rem" }}>
                  {item.proposed ? (
                    <span style={{ fontSize: "0.75rem", color: "var(--green)", display: "flex", alignItems: "center", gap: "0.25rem", fontWeight: "bold" }}>
                      <Check size={14} /> Đã gửi sang Strategy Agent xử lý
                    </span>
                  ) : (
                    <button
                      onClick={() => handlePropose(item.id)}
                      disabled={loadingId !== null}
                      style={{ 
                        padding: "0.35rem 0.65rem", 
                        fontSize: "0.75rem",
                        background: "var(--blue)",
                        color: "#fff",
                        borderColor: "var(--blue)"
                      }}
                    >
                      {loadingId === item.id ? (
                        <>
                          <RefreshCw size={12} className="animate-spin" /> Đang gửi...
                        </>
                      ) : (
                        <>
                          <Send size={12} /> Đề xuất phản hồi chiến dịch
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Right Side: Market Research Insights (F02, từ /api/market-research) */}
        <section className="panel" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <div className="panel-title">
              <TrendingUp size={18} style={{ color: "var(--teal)" }} />
              <h2>Insight Thị trường (Market Research)</h2>
            </div>
            <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: "0.2rem 0 0.8rem" }}>
              Market Radar Agent tổng hợp insight có nguồn, độ tin cậy và góc truyền thông dùng được.
            </p>
          </div>

          <div style={{ display: "grid", gap: "0.7rem", fontSize: "0.82rem" }}>
            {insights.length > 0 ? (
              insights.map((insight) => (
                <div key={insight.id} style={{ border: "1px solid var(--line)", borderRadius: "6px", padding: "0.6rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                    <span className="badge ready" style={{ fontSize: "0.6rem" }}>{insight.sourceType}</span>
                    <strong style={{ fontSize: "0.72rem", color: "var(--teal)" }}>
                      Tin cậy {Math.round(insight.confidence * 100)}%
                    </strong>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.78rem", lineHeight: 1.4 }}>{insight.statement}</p>
                  <div style={{ marginTop: "0.4rem", fontSize: "0.72rem", color: "var(--blue)", display: "flex", gap: "0.3rem", alignItems: "flex-start" }}>
                    <Sparkles size={12} style={{ flexShrink: 0, marginTop: "0.1rem", color: "var(--amber)" }} />
                    {insight.mediaAngle}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ display: "grid", placeItems: "center", height: "150px", border: "1px dashed var(--line)", borderRadius: "6px", color: "var(--muted)", fontSize: "0.78rem", textAlign: "center", padding: "0.5rem" }}>
                Chưa có insight. Chạy `npm run control:api` để nhận dữ liệu Market Research thật.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

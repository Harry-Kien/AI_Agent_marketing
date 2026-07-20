import { CheckCircle2, ShieldCheck, XCircle, AlertCircle, RefreshCw } from "lucide-react";
import { useState } from "react";
import type { OfficeSnapshot } from "./types";

interface ApprovalDeskProps {
  snapshot: OfficeSnapshot;
  onAction: (action: "approve" | "reject" | "revise", feedback?: string) => Promise<void>;
}

export function ApprovalDesk({ snapshot, onAction }: ApprovalDeskProps) {
  const [feedback, setFeedback] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const getActiveAgentForStage = (stage: string) => {
    const cleanStage = stage.toLowerCase();
    if (cleanStage.includes("research")) return snapshot.agents.find(a => a.id === "radar");
    if (cleanStage.includes("content")) return snapshot.agents.find(a => a.id === "copy");
    if (cleanStage.includes("creative")) return snapshot.agents.find(a => a.id === "creative");
    if (cleanStage.includes("brand")) return snapshot.agents.find(a => a.id === "brand");
    if (cleanStage.includes("final")) return snapshot.agents.find(a => a.id === "manager");
    if (cleanStage.includes("publish")) return snapshot.agents.find(a => a.id === "growth");
    return undefined;
  };

  const activeAgent = snapshot.agents.find((a) => a.state === "waiting_approval") || getActiveAgentForStage(snapshot.stage);

  const handleApprove = async () => {
    setLoading(true);
    try {
      await onAction("approve");
      setShowRejectForm(false);
      setFeedback("");
    } finally {
      setLoading(false);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) return;
    setLoading(true);
    try {
      await onAction("reject", feedback);
      setShowRejectForm(false);
      setFeedback("");
    } finally {
      setLoading(false);
    }
  };

  const handleReviseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) return;
    setLoading(true);
    try {
      await onAction("revise", feedback);
      setShowRejectForm(false);
      setFeedback("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel approval-desk" style={{ borderLeft: "5px solid var(--amber)" }}>
      <div className="office-section-head">
        <div style={{ display: "flex", gap: "0.45rem", alignItems: "center" }}>
          <ShieldCheck size={18} style={{ color: "var(--amber)" }} />
          <strong>Bàn phê duyệt chiến dịch</strong>
        </div>
        <span className="badge warning">{snapshot.approvals} pending</span>
      </div>

      {snapshot.approvals > 0 && activeAgent ? (
        <div style={{ display: "grid", gap: "0.85rem", marginTop: "0.5rem" }}>
          <div style={{ background: "#fffdf5", border: "1px solid #ffe3a8", padding: "0.85rem", borderRadius: "6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.72rem", color: "var(--amber)", fontWeight: "bold" }}>
                GIAI ĐOẠN: {snapshot.stage.toUpperCase()}
              </span>
              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Agent: {activeAgent.name}</span>
            </div>
            <h3 style={{ margin: "0.4rem 0 0.2rem", fontSize: "1rem" }}>{snapshot.campaignTitle}</h3>
            <p style={{ margin: "0.2rem 0 0.6rem", fontSize: "0.78rem", color: "var(--muted)" }}>
              Nhiệm vụ đang chờ duyệt: <strong>{activeAgent.task}</strong>
            </p>

            <div style={{ background: "#fff", border: "1px solid var(--line)", padding: "0.65rem", borderRadius: "4px", fontSize: "0.8rem", maxHeight: "140px", overflowY: "auto", margin: "0.5rem 0" }}>
              <strong style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.75rem", color: "var(--muted)" }}>
                NỘI DUNG GÓI TÀI LIỆU (PREVIEW):
              </strong>
              {snapshot.stage.includes("research") && (
                <div>
                  <p><strong>Target Customer Profile:</strong> Doanh nghiệp vừa và nhỏ (SME) Việt Nam.</p>
                  <p><strong>Pain points:</strong> Chi phí marketing cao, thiếu nhân sự content chuyên nghiệp.</p>
                  <p><strong>Competitor Angle:</strong> Nhấn mạnh giải pháp AI làm việc 24/7 với chi phí rẻ hơn 70%.</p>
                </div>
              )}
              {snapshot.stage.includes("content") && (
                <div>
                  <p><strong>Tiêu đề Facebook:</strong> 🚀 Giải phóng sức mạnh AI cho SME của bạn!</p>
                  <p><strong>Main Body:</strong> Tiết kiệm 70% chi phí marketing ngoài bằng đội ngũ AI Agent.</p>
                  <p><strong>CTA:</strong> Đặt lịch tư vấn miễn phí ngay hôm nay.</p>
                </div>
              )}
              {snapshot.stage.includes("creative") && (
                <div>
                  <p><strong>Creative Concept:</strong> Bàn làm việc số của tương lai với 6 Agent.</p>
                  <p><strong>Visual Prompt:</strong> Futuristic digital office desk, holographic screens showing graphs...</p>
                </div>
              )}
              {!snapshot.stage.includes("research") && !snapshot.stage.includes("content") && !snapshot.stage.includes("creative") && (
                <p>Bản xem trước gói tài liệu tổng hợp chiến dịch đang chờ xuất bản.</p>
              )}
            </div>

            {loading ? (
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--muted)", fontSize: "0.8rem", padding: "0.5rem 0" }}>
                <RefreshCw size={14} className="animate-spin" /> Đang xử lý quyết định...
              </div>
            ) : !showRejectForm ? (
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                <button
                  onClick={handleApprove}
                  className="approve-button"
                  style={{
                    background: "var(--green)",
                    color: "#fff",
                    borderColor: "var(--green)",
                    padding: "0.45rem 0.75rem",
                    fontSize: "0.8rem",
                    borderRadius: "5px"
                  }}
                >
                  <CheckCircle2 size={14} /> Duyệt & Chuyển Stage
                </button>
                <button
                  onClick={() => setShowRejectForm(true)}
                  style={{ padding: "0.45rem 0.75rem", fontSize: "0.8rem", borderRadius: "5px" }}
                >
                  <XCircle size={14} /> Trả lại / Sửa
                </button>
              </div>
            ) : (
              <form onSubmit={handleRejectSubmit} style={{ marginTop: "0.75rem", display: "grid", gap: "0.5rem" }}>
                <textarea
                  placeholder="Nhập lý do từ chối hoặc feedback chỉnh sửa..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  required
                  style={{ fontSize: "0.8rem", minHeight: "60px", padding: "0.4rem" }}
                />
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  <button
                    type="submit"
                    style={{
                      background: "var(--red)",
                      color: "#fff",
                      borderColor: "var(--red)",
                      padding: "0.35rem 0.6rem",
                      fontSize: "0.75rem"
                    }}
                  >
                    Từ chối (Reject)
                  </button>
                  <button
                    type="button"
                    onClick={handleReviseSubmit}
                    disabled={!feedback.trim()}
                    style={{
                      background: "var(--blue)",
                      color: "#fff",
                      borderColor: "var(--blue)",
                      padding: "0.35rem 0.6rem",
                      fontSize: "0.75rem"
                    }}
                  >
                    Yêu cầu sửa (Revise)
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRejectForm(false)}
                    style={{ padding: "0.35rem 0.6rem", fontSize: "0.75rem" }}
                  >
                    Hủy
                  </button>
                </div>
              </form>
            )}
          </div>
          <small style={{ color: "var(--muted)", fontSize: "0.72rem" }}>
            Mọi phê duyệt chính thức được log audit lại để kiểm tra an toàn thương hiệu.
          </small>
        </div>
      ) : (
        <div style={{ padding: "1rem 0", textAlign: "center", color: "var(--muted)", fontSize: "0.85rem" }}>
          <AlertCircle size={24} style={{ color: "var(--muted)", margin: "0 auto 0.4rem" }} />
          <p>Không có gói công việc nào đang chờ duyệt.</p>
          <small>Các Agent sẽ tiếp tục xử lý khi có tín hiệu chiến dịch mới.</small>
        </div>
      )}
    </section>
  );
}

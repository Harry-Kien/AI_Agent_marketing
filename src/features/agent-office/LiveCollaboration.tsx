import { Activity, MessageSquare, ShieldAlert, Check, RefreshCw } from "lucide-react";
import type { OfficeSnapshot } from "./types";

interface LiveCollaborationProps {
  snapshot: OfficeSnapshot;
}

export function LiveCollaboration({ snapshot }: LiveCollaborationProps) {
  const getIcon = (actor: string, message: string) => {
    const cleanMsg = message.toLowerCase();
    if (cleanMsg.includes("duyệt") || cleanMsg.includes("approve")) {
      return <Check size={13} style={{ color: "var(--green)" }} />;
    }
    if (cleanMsg.includes("từ chối") || cleanMsg.includes("reject") || cleanMsg.includes("lỗi")) {
      return <ShieldAlert size={13} style={{ color: "var(--red)" }} />;
    }
    if (actor.toLowerCase().includes("bạn") || actor.toLowerCase().includes("operator")) {
      return <MessageSquare size={13} style={{ color: "var(--blue)" }} />;
    }
    return <Activity size={13} style={{ color: "var(--muted)" }} />;
  };

  return (
    <section className="panel activity-log">
      <div className="office-section-head">
        <div style={{ display: "flex", gap: "0.45rem", alignItems: "center" }}>
          <Activity size={18} style={{ color: "var(--blue)" }} />
          <strong>Nhật ký phối hợp trực tiếp</strong>
        </div>
        <span style={{ fontSize: "0.7rem", fontWeight: "bold", color: "var(--green)" }}>LIVE</span>
      </div>

      <div style={{ display: "grid", gap: "0.55rem", marginTop: "0.5rem" }}>
        {snapshot.activity.length ? (
          snapshot.activity.map((item) => (
            <div className="activity-item" key={item.id} style={{ borderTop: "1px solid #f0f3f8" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <time style={{ fontSize: "0.72rem", color: "var(--muted)", fontStyle: "italic" }}>{item.time}</time>
                <div
                  style={{
                    display: "grid",
                    placeItems: "center",
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    background: "#f0f4f8"
                  }}
                >
                  {getIcon(item.actor, item.message)}
                </div>
              </div>
              <div style={{ marginTop: "0.2rem" }}>
                <strong style={{ fontSize: "0.78rem", color: "var(--ink)" }}>{item.actor}</strong>
                <p style={{ margin: "0.1rem 0 0", fontSize: "0.76rem", color: "var(--muted)", lineHeight: "1.4" }}>
                  {item.message}
                </p>
              </div>
            </div>
          ))
        ) : (
          <p style={{ padding: "1rem", textAlign: "center", color: "var(--muted)", fontSize: "0.8rem" }}>
            Chưa có ghi nhận hoạt động nào.
          </p>
        )}
      </div>
    </section>
  );
}

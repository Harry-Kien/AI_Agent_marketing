import { CheckCircle2, Circle, Clock, Play } from "lucide-react";
import type { OfficeSnapshot } from "./types";

interface WorkflowGraphProps {
  snapshot: OfficeSnapshot;
}

export function WorkflowGraph({ snapshot }: WorkflowGraphProps) {
  const stages = [
    { id: "intake", label: "Tiếp nhận brief", desc: "Manager Bot" },
    { id: "research", label: "Nghiên cứu", desc: "Market Radar" },
    { id: "content", label: "Nội dung", desc: "Content Creator" },
    { id: "creative", label: "Creative", desc: "Strategy & Visual" },
    { id: "brand", label: "Kiểm định", desc: "Brand & KPI" },
    { id: "final", label: "Tổng hợp", desc: "Manager Compile" },
    { id: "publish", label: "Xuất bản", desc: "Page Growth" }
  ];

  const getStageIndex = (stageStr: string) => {
    const cleanStage = stageStr.toLowerCase();
    for (let i = 0; i < stages.length; i++) {
      if (cleanStage.includes(stages[i].id)) return i;
    }
    return 0;
  };

  const activeIndex = getStageIndex(snapshot.stage);

  return (
    <section className="panel" style={{ padding: "1.1rem" }}>
      <div className="panel-title" style={{ marginBottom: "1rem" }}>
        <ActivityIcon size={18} style={{ color: "var(--teal)" }} />
        <h2>Sơ đồ luồng xử lý chiến dịch (Workflow Pipeline)</h2>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", overflowX: "auto", paddingBottom: "0.5rem" }}>
        {stages.map((stage, idx) => {
          const isDone = idx < activeIndex;
          const isActive = idx === activeIndex;
          const isPendingApproval = isActive && snapshot.stage.includes("pending_approval");
          
          let color = "#98a2b3";
          let bg = "#fff";
          let border = "1px solid var(--line)";
          if (isDone) {
            color = "var(--green)";
            bg = "#f0faf5";
            border = "1px solid #a3e635";
          } else if (isActive) {
            color = isPendingApproval ? "var(--amber)" : "var(--blue)";
            bg = isPendingApproval ? "#fffcf3" : "#f0f5ff";
            border = isPendingApproval ? "1px solid #fde047" : "1px solid #bfdbfe";
          }

          return (
            <div key={stage.id} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: "120px" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "24px 1fr",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.55rem 0.65rem",
                  borderRadius: "6px",
                  background: bg,
                  border: border,
                  flex: 1,
                  boxShadow: isActive ? "0 4px 6px -1px rgba(0, 0, 0, 0.05)" : "none"
                }}
              >
                <div style={{ color: color, display: "grid", placeItems: "center" }}>
                  {isDone ? (
                    <CheckCircle2 size={16} />
                  ) : isActive ? (
                    isPendingApproval ? (
                      <Clock size={16} className="animate-pulse" />
                    ) : (
                      <Play size={14} className="animate-pulse" />
                    )
                  ) : (
                    <Circle size={15} />
                  )}
                </div>
                <div style={{ lineHeight: "1.2" }}>
                  <strong style={{ display: "block", fontSize: "0.78rem", color: isActive ? "var(--ink)" : "var(--muted)" }}>
                    {stage.label}
                  </strong>
                  <span style={{ fontSize: "0.62rem", color: "var(--muted)" }}>{stage.desc}</span>
                </div>
              </div>

              {idx < stages.length - 1 && (
                <div style={{ width: "16px", height: "2px", background: isDone ? "var(--green)" : "var(--line)", margin: "0 0.25rem" }} />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ActivityIcon({ size, style }: { size: number; style?: React.CSSProperties }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

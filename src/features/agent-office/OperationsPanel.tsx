import { useEffect, useState } from "react";
import { Brain, Cpu, HardDrive, ShieldCheck } from "lucide-react";
import { loadMemory, loadTelemetry } from "./api";
import type { MemoryView, OfficeSnapshot, TelemetryView } from "./types";

interface OperationsPanelProps {
  snapshot: OfficeSnapshot;
}

const verdictColor: Record<string, string> = {
  pass: "var(--green)",
  revise: "var(--amber)",
  block: "var(--red)"
};

export function OperationsPanel({ snapshot }: OperationsPanelProps) {
  const [telemetry, setTelemetry] = useState<TelemetryView | null>(null);
  const [memory, setMemory] = useState<MemoryView | null>(null);

  useEffect(() => {
    let active = true;
    loadTelemetry().then((data) => active && data && setTelemetry(data));
    loadMemory().then((data) => active && data && setMemory(data));
    return () => {
      active = false;
    };
  }, []);

  const totals = telemetry?.totals;
  const live = Boolean(telemetry?.connected);

  return (
    <section className="view-grid">
      <div className="metric-grid">
        <article className="metric ready" style={{ borderLeftColor: "var(--green)" }}>
          <span>Nguồn dữ liệu</span>
          <strong>{live ? "Realtime" : "Dữ liệu mẫu"}</strong>
        </article>
        <article className="metric" style={{ borderLeftColor: "var(--blue)" }}>
          <span>Chi phí AI lũy kế</span>
          <strong>{totals ? `$${totals.totalCostUsd.toFixed(4)}` : "—"}</strong>
        </article>
        <article className="metric" style={{ borderLeftColor: "var(--blue)" }}>
          <span>Số lượt agent (spans)</span>
          <strong>{totals ? totals.spans : "—"}</strong>
        </article>
        <article className="metric ready" style={{ borderLeftColor: "var(--teal)" }}>
          <span>Điểm eval trung bình</span>
          <strong>{totals ? `${totals.avgEvalScore}/100` : "—"}</strong>
        </article>
        <article
          className="metric"
          style={{ borderLeftColor: totals && totals.driftRatio > 0.3 ? "var(--red)" : "var(--green)" }}
        >
          <span>Tỉ lệ drift (bị eval chặn/sửa)</span>
          <strong>{totals ? `${Math.round(totals.driftRatio * 100)}%` : "—"}</strong>
        </article>
      </div>

      <div className="split">
        <section className="panel" style={{ flex: 1.4 }}>
          <div className="panel-title" style={{ justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Cpu size={18} style={{ color: "var(--teal)" }} />
              <h2>Observability — Trace mỗi lượt agent (span)</h2>
            </div>
            <span className={`badge ${live ? "ready" : "muted"}`} style={{ fontSize: "0.62rem" }}>
              {live ? "● Realtime" : "○ Dữ liệu mẫu"}
            </span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ fontSize: "0.8rem", width: "100%" }}>
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Stage</th>
                  <th>Model tier</th>
                  <th>Chi phí</th>
                  <th>Eval</th>
                  <th>Verdict</th>
                </tr>
              </thead>
              <tbody>
                {telemetry && telemetry.recent.length > 0 ? (
                  telemetry.recent.map((span) => (
                    <tr key={span.runId}>
                      <td>{span.role}</td>
                      <td>{span.stage}</td>
                      <td>
                        <code>{span.tier}</code> · {span.mode}
                      </td>
                      <td>${span.costUsd.toFixed(5)}</td>
                      <td>{span.evalScore}</td>
                      <td>
                        <span style={{ color: verdictColor[span.verdict], fontWeight: "bold" }}>● {span.verdict}</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ color: "var(--muted)", textAlign: "center", padding: "1rem" }}>
                      Chưa có lượt agent nào. Khởi chạy một chiến dịch để sinh trace.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {telemetry && telemetry.byTier.some((tier) => tier.spans > 0) && (
            <div style={{ marginTop: "0.9rem", borderTop: "1px dashed var(--line)", paddingTop: "0.7rem" }}>
              <span style={{ fontSize: "0.72rem", fontWeight: "bold", color: "var(--muted)" }}>CHI PHÍ THEO MODEL TIER</span>
              <div style={{ display: "flex", gap: "1.2rem", marginTop: "0.4rem", fontSize: "0.8rem", flexWrap: "wrap" }}>
                {telemetry.byTier.map((tier) => (
                  <span key={tier.tier}>
                    <code>{tier.tier}</code>: {tier.spans} lượt · ${tier.costUsd.toFixed(5)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-title">
            <Brain size={18} style={{ color: "var(--violet)" }} />
            <h2>Ký ức chiến dịch (Long-term Memory)</h2>
          </div>
          <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: "0.2rem 0 0.8rem" }}>
            Hệ thống đã học từ <strong>{memory?.count ?? 0}</strong> chiến dịch trước để cải thiện chiến dịch sau.
          </p>
          <div style={{ display: "grid", gap: "0.6rem" }}>
            {memory && memory.memories.length > 0 ? (
              memory.memories.map((item) => (
                <div key={item.campaignId} style={{ border: "1px solid var(--line)", borderRadius: "6px", padding: "0.6rem", fontSize: "0.78rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                    <strong>{item.campaignId}</strong>
                    <span className="badge ready" style={{ fontSize: "0.6rem" }}>
                      KPI {Math.round(item.overallAttainment * 100)}%
                    </span>
                  </div>
                  <p style={{ margin: "0 0 0.3rem", color: "var(--muted)" }}>{item.brief}</p>
                  {item.lessons[0] && (
                    <div style={{ color: "var(--blue)", fontSize: "0.72rem" }}>· {item.lessons[0]}</div>
                  )}
                </div>
              ))
            ) : (
              <div style={{ display: "grid", placeItems: "center", height: "120px", border: "1px dashed var(--line)", borderRadius: "6px", color: "var(--muted)", fontSize: "0.78rem", textAlign: "center", padding: "0.5rem" }}>
                Chưa có ký ức. Hoàn tất một chiến dịch (đăng) để hệ thống bắt đầu học.
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-title">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <ShieldCheck size={18} style={{ color: "var(--green)" }} />
            <h2>Bảo mật & Vận hành</h2>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.65rem", fontSize: "0.82rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Auth write-path</span>
            <strong>Bearer token</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Rate-limit + headers</span>
            <strong>Active</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Persistence + backup</span>
            <strong>Atomic JSON · 10 bản</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Meta publish</span>
            <strong>{snapshot.services.find((s) => s.name === "Meta Page")?.state ?? "Guarded"}</strong>
          </div>
        </div>
      </section>
    </section>
  );
}

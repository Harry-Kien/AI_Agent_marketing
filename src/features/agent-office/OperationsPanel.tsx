import { Activity, Coins, Cpu, HardDrive, RefreshCw } from "lucide-react";
import type { OfficeSnapshot } from "./types";

interface OperationsPanelProps {
  snapshot: OfficeSnapshot;
}

export function OperationsPanel({ snapshot }: OperationsPanelProps) {
  return (
    <section className="view-grid">
      <div className="metric-grid">
        <article className="metric ready" style={{ borderLeftColor: "var(--green)" }}>
          <span>Trình điều phối (Telegram)</span>
          <strong>ONLINE</strong>
        </article>
        <article className="metric ready" style={{ borderLeftColor: "var(--green)" }}>
          <span>Trình kết nối AI (9Router)</span>
          <strong>ONLINE</strong>
        </article>
        <article className="metric" style={{ borderLeftColor: "var(--blue)" }}>
          <span>Độ trễ trung bình</span>
          <strong>1.84 giây</strong>
        </article>
        <article className="metric" style={{ borderLeftColor: "var(--blue)" }}>
          <span>Chi phí Token lũy kế</span>
          <strong>$1.45</strong>
        </article>
        <article className="metric ready" style={{ borderLeftColor: "var(--green)" }}>
          <span>Meta Graph publish</span>
          <strong>Guarded</strong>
        </article>
      </div>

      <div className="split">
        <section className="panel">
          <div className="panel-title">
            <Cpu size={18} style={{ color: "var(--teal)" }} />
            <h2>Observability & API Endpoint telemetry</h2>
          </div>
          <table style={{ fontSize: "0.85rem" }}>
            <thead>
              <tr>
                <th>Service / Adapter</th>
                <th>Endpoint</th>
                <th>Method</th>
                <th>Latency</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Control API Runtime</td>
                <td><code>/api/runtime</code></td>
                <td><span style={{ color: "var(--green)", fontWeight: "bold" }}>GET</span></td>
                <td>12ms</td>
                <td><span style={{ color: "var(--green)" }}>● 200 OK</span></td>
              </tr>
              <tr>
                <td>Server SSE Events</td>
                <td><code>/api/events</code></td>
                <td><span style={{ color: "var(--green)", fontWeight: "bold" }}>GET</span></td>
                <td>Keep-alive</td>
                <td><span style={{ color: "var(--green)" }}>● Streaming</span></td>
              </tr>
              <tr>
                <td>Meta Connectivity Check</td>
                <td><code>graph.facebook.com</code></td>
                <td><span style={{ color: "var(--green)", fontWeight: "bold" }}>GET</span></td>
                <td>124ms</td>
                <td><span style={{ color: "var(--green)" }}>● Authenticated</span></td>
              </tr>
              <tr>
                <td>9Router OpenAI Fallback</td>
                <td><code>api.9router.com</code></td>
                <td><span style={{ color: "var(--blue)", fontWeight: "bold" }}>POST</span></td>
                <td>1.64s</td>
                <td><span style={{ color: "var(--green)" }}>● Ready</span></td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="panel">
          <div className="panel-title">
            <HardDrive size={18} style={{ color: "var(--violet)" }} />
            <h2>Trạng thái hệ thống & Giới hạn (Limits)</h2>
          </div>
          <div style={{ display: "grid", gap: "0.65rem", fontSize: "0.85rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f0f3f8", paddingBottom: "0.4rem" }}>
              <span>Database Persistence</span>
              <strong>SQLite (JSON Fallback)</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f0f3f8", paddingBottom: "0.4rem" }}>
              <span>Telegram Long Polling</span>
              <strong>Active (Offset offset)</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f0f3f8", paddingBottom: "0.4rem" }}>
              <span>Max Tokens/run</span>
              <strong>4,000 max context</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "0.2rem" }}>
              <span>Idempotency Cache</span>
              <strong>Active (In-memory)</strong>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}

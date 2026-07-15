import { Activity, Bot, CheckCircle2, CircleDashed, Clock3, Radio, RefreshCw, ShieldCheck, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { loadOfficeSnapshot, officeFallback } from "./api";
import type { OfficeSnapshot } from "./types";

const stages = [
  ["intake", "Tiếp nhận"], ["research", "Nghiên cứu"], ["content", "Nội dung"],
  ["creative", "Sáng tạo"], ["brand", "Kiểm định"], ["final", "Tổng hợp"], ["publish", "Xuất bản"]
] as const;

function stateLabel(state: string) {
  return ({ working: "Đang soạn", waiting_approval: "Chờ duyệt", available: "Sẵn sàng", offline: "Mất kết nối" } as Record<string, string>)[state] ?? state;
}

export function AgentOfficeView() {
  const [snapshot, setSnapshot] = useState<OfficeSnapshot>(officeFallback);
  const refresh = () => void loadOfficeSnapshot().then(setSnapshot);
  useEffect(() => {
    refresh();
    const stream = new EventSource("http://127.0.0.1:8787/api/events");
    const receive = (event: MessageEvent<string>) => {
      try { setSnapshot({ ...(JSON.parse(event.data) as OfficeSnapshot), connected: true }); } catch { /* Ignore malformed local events. */ }
    };
    stream.addEventListener("runtime", receive as EventListener);
    stream.onerror = () => setSnapshot((current) => ({ ...current, connected: false }));
    return () => { stream.removeEventListener("runtime", receive as EventListener); stream.close(); };
  }, []);
  const activeIndex = Math.max(0, stages.findIndex(([key]) => snapshot.stage.includes(key)));

  return (
    <section className="office-view" aria-label="Văn phòng Agent Marketing">
      <header className="office-commandbar">
        <div>
          <span className="office-kicker">CAMPAIGN CONTROL ROOM</span>
          <h1>{snapshot.campaignTitle}</h1>
          <p><strong>{snapshot.campaignId}</strong> · {snapshot.approvals} kết quả đang chờ bạn quyết định</p>
        </div>
        <div className="office-connection">
          <span className={snapshot.connected ? "live" : "preview"}>{snapshot.connected ? <Radio size={14} /> : <WifiOff size={14} />}{snapshot.connected ? "Realtime" : "Dữ liệu mẫu"}</span>
          <button onClick={refresh} title="Làm mới dữ liệu"><RefreshCw size={16} /> Làm mới</button>
        </div>
      </header>

      <div className="workflow-rail" aria-label="Luồng chiến dịch">
        {stages.map(([key, label], index) => (
          <div className={`rail-stage ${index < activeIndex ? "done" : index === activeIndex ? "active" : "upcoming"}`} key={key}>
            <span>{index < activeIndex ? <CheckCircle2 size={17} /> : index === activeIndex ? <CircleDashed size={17} /> : <Clock3 size={16} />}</span>
            <strong>{label}</strong><small>{index === activeIndex ? "Đang xử lý" : index < activeIndex ? "Đã duyệt" : "Chờ bàn giao"}</small>
          </div>
        ))}
      </div>

      <div className="office-layout">
        <div className="workstation-area">
          <div className="office-section-head"><div><Bot size={18} /><strong>Đội ngũ Agent</strong></div><span>6/6 vai trò</span></div>
          <div className="workstation-grid">
            {snapshot.agents.map((agent, index) => (
              <article className={`workstation ${agent.state}`} key={agent.id}>
                <div className="desk-number">0{index + 1}</div>
                <div className="agent-avatar"><Bot size={20} /></div>
                <div className="agent-copy"><h3>{agent.name}</h3><p>{agent.department}</p></div>
                <span className="agent-state"><i />{stateLabel(agent.state)}</span>
                <div className="agent-task"><small>NHIỆM VỤ HIỆN TẠI</small><strong>{agent.task}</strong></div>
                <div className="agent-meta"><span>Phản hồi {agent.latency}</span><span>{agent.state === "waiting_approval" ? "Cần bạn duyệt" : "Theo stage-gate"}</span></div>
              </article>
            ))}
          </div>
        </div>

        <aside className="office-side">
          <section className="approval-desk"><div className="office-section-head"><div><ShieldCheck size={18} /><strong>Bàn phê duyệt</strong></div><span>{snapshot.approvals}</span></div><h3>{snapshot.approvals ? "Gói công việc đang chờ" : "Không có gói chờ duyệt"}</h3><p>{snapshot.approvals ? "Mở Manager Bot để xem đầy đủ bằng chứng và đưa ra quyết định." : "Các Agent chỉ chuyển stage khi có quyết định hợp lệ từ người quản lý."}</p><div><button className="approve-button" disabled title="Phê duyệt an toàn qua Manager Bot"><CheckCircle2 size={15} /> Duyệt qua Telegram</button><button disabled title="Yêu cầu sửa qua Manager Bot">Yêu cầu sửa</button></div><small>Dashboard chỉ quan sát. Quyền phê duyệt thuộc Admin đã khóa Telegram User ID.</small></section>
          <section className="activity-log"><div className="office-section-head"><div><Activity size={18} /><strong>Phối hợp trực tiếp</strong></div><span>LIVE</span></div>{snapshot.activity.map((item) => <div className="activity-item" key={item.id}><time>{item.time}</time><div><strong>{item.actor}</strong><p>{item.message}</p></div></div>)}</section>
          <section className="service-strip">{snapshot.services.map((service) => <div key={service.name}><i className={service.state} /><span><strong>{service.name}</strong><small>{service.detail}</small></span></div>)}</section>
        </aside>
      </div>
    </section>
  );
}

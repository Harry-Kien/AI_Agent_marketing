import {
  Activity,
  AlertTriangle,
  Building2,
  ClipboardList,
  LayoutDashboard,
  MessageSquare,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingUp,
  Video
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { AgentOfficeView } from "./features/agent-office/AgentOfficeView";
import { ApprovalDesk } from "./features/agent-office/ApprovalDesk";
import { WorkflowGraph } from "./features/agent-office/WorkflowGraph";
import { LiveCollaboration } from "./features/agent-office/LiveCollaboration";
import { CommunityInbox } from "./features/agent-office/CommunityInbox";
import { OperationsPanel } from "./features/agent-office/OperationsPanel";
import { CampaignBoard } from "./features/agent-office/CampaignBoard";
import { CompetitorList } from "./features/agent-office/CompetitorList";
import { ContentStudio } from "./features/agent-office/ContentStudio";
import { loadAnalytics, loadOfficeSnapshot, officeFallback } from "./features/agent-office/api";
import type { AnalyticsView, OfficeSnapshot } from "./features/agent-office/types";

type View = "office" | "dashboard" | "campaigns" | "competitors" | "studio" | "community" | "operations";

const navItems = [
  { id: "office" as View, label: "Văn phòng Agent", icon: Building2 },
  { id: "dashboard" as View, label: "Tổng quan", icon: LayoutDashboard },
  { id: "campaigns" as View, label: "Bảng Chiến dịch", icon: ClipboardList },
  { id: "competitors" as View, label: "Đối thủ cạnh tranh", icon: Search },
  { id: "studio" as View, label: "Content & Video Studio", icon: Video },
  { id: "community" as View, label: "Chăm sóc & Lead", icon: MessageSquare },
  { id: "operations" as View, label: "Vận hành hệ thống", icon: Activity }
];

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

function Badge({ value, tone }: { value: string; tone?: string }) {
  return <span className={`badge ${tone ?? value}`}>{statusLabel(value)}</span>;
}

function App() {
  const [activeView, setActiveView] = useState<View>("office");
  const [snapshot, setSnapshot] = useState<OfficeSnapshot>(officeFallback);
  const [analytics, setAnalytics] = useState<AnalyticsView | null>(null);

  const refresh = () => {
    loadOfficeSnapshot().then(setSnapshot);
    loadAnalytics().then(setAnalytics);
  };

  useEffect(() => {
    refresh();
    const stream = new EventSource("http://127.0.0.1:8787/api/events");
    const receive = (event: MessageEvent<string>) => {
      try {
        setSnapshot({ ...(JSON.parse(event.data) as OfficeSnapshot), connected: true });
      } catch {
        /* Ignore malformed local events. */
      }
    };
    stream.addEventListener("runtime", receive as EventListener);
    stream.onerror = () => setSnapshot((current) => ({ ...current, connected: false }));
    return () => {
      stream.removeEventListener("runtime", receive as EventListener);
      stream.close();
    };
  }, []);

  const handleApprovalAction = async (action: "approve" | "reject" | "revise", feedback?: string) => {
    if (snapshot.connected) {
      try {
        let endpoint = "";
        if (action === "approve") {
          endpoint = `http://127.0.0.1:8787/api/approvals/active/approve`;
        } else if (action === "reject") {
          endpoint = `http://127.0.0.1:8787/api/approvals/active/reject`;
        } else {
          endpoint = `http://127.0.0.1:8787/api/runs/active/revise`;
        }
        
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feedback })
        });
        if (response.ok) {
          refresh();
          return;
        }
      } catch (err) {
        console.warn("API action failed, falling back to local simulation.", err);
      }
    }

    // Local Simulation fallback
    await new Promise((resolve) => setTimeout(resolve, 800)); // Simulate network latency
    if (action === "approve") {
      setSnapshot((current) => {
        const stages = ["intake", "research", "content", "creative", "brand", "final", "publish"];
        const currentIndex = stages.findIndex((s) => current.stage.toLowerCase().includes(s));
        const nextIndex = Math.min(stages.length - 1, currentIndex + 1);
        const isFinalStage = nextIndex === stages.length - 1;
        const nextStage = stages[nextIndex] + (isFinalStage ? "" : "_running");
        
        const updatedAgents = current.agents.map((agent) => {
          if (agent.state === "waiting_approval") {
            return { ...agent, state: "available" as const, task: "Đã hoàn thành bàn giao" };
          }
          const nextAgentId = stages[nextIndex] === "research" ? "market-radar" :
                              stages[nextIndex] === "content" ? "content-creator" :
                              stages[nextIndex] === "creative" ? "creative-director" :
                              stages[nextIndex] === "brand" ? "brand-guardian" :
                              stages[nextIndex] === "final" ? "manager" : "page-growth";
          if (agent.id === nextAgentId) {
            return { ...agent, state: "working" as const, task: `Đang xử lý ${stages[nextIndex]} package` };
          }
          return agent;
        });

        const newEvent = {
          id: `sim-evt-${Date.now()}`,
          time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
          actor: "Bạn (Dashboard)",
          message: `Đã duyệt giai đoạn ${statusLabel(current.stage)}. Tiến hành chuyển tiếp.`
        };

        return {
          ...current,
          stage: nextStage,
          approvals: 0,
          agents: updatedAgents,
          activity: [newEvent, ...current.activity].slice(0, 12)
        };
      });
    } else {
      setSnapshot((current) => {
        const updatedAgents = current.agents.map((agent) => {
          if (agent.state === "waiting_approval") {
            return { ...agent, state: "working" as const, task: `Chỉnh sửa: ${feedback || "Cần điều chỉnh nội dung"}` };
          }
          return agent;
        });

        const newEvent = {
          id: `sim-evt-${Date.now()}`,
          time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
          actor: "Bạn (Dashboard)",
          message: `Yêu cầu sửa / Từ chối: ${feedback || "Cần điều chỉnh nội dung"}`
        };

        return {
          ...current,
          approvals: 0,
          agents: updatedAgents,
          activity: [newEvent, ...current.activity].slice(0, 12)
        };
      });
    }
  };

  const renderDashboard = () => (
    <section className="view-grid">
      <div className="hero-panel">
        <div>
          <p className="eyebrow">Bàn điều hành AI Marketing</p>
          <h1>{snapshot.campaignTitle}</h1>
          <p style={{ marginTop: "0.5rem" }}>
            Mã chiến dịch: <strong>{snapshot.campaignId}</strong> · Giai đoạn hiện tại: <strong>{statusLabel(snapshot.stage)}</strong>
          </p>
        </div>
        <div className="brief-card">
          <span>Yêu cầu cần duyệt</span>
          <strong>{snapshot.approvals} gói công việc</strong>
          <p>{snapshot.approvals ? "Vui lòng mở Telegram hoặc Bàn phê duyệt để xử lý." : "Hiện không có gói nào chờ duyệt."}</p>
        </div>
      </div>

      <WorkflowGraph snapshot={snapshot} />

      <div className="metric-grid">
        <article className="metric ready">
          <span>Trạng thái kết nối</span>
          <strong>{snapshot.connected ? "Realtime" : "Dữ liệu mẫu"}</strong>
        </article>
        <article className="metric">
          <span>Đội ngũ Agent</span>
          <strong>6 / 6 vai trò</strong>
        </article>
        <article className="metric danger">
          <span>Cảnh báo rủi ro</span>
          <strong>0 rủi ro</strong>
        </article>
        <article className="metric">
          <span>KPI đạt tổng thể</span>
          <strong>{analytics ? `${Math.round(analytics.overallAttainment * 100)}%` : "—"}</strong>
        </article>
        <article className="metric ready">
          <span>Lead so với mục tiêu</span>
          <strong>
            {(() => {
              const lead = analytics?.kpis.find((kpi) => kpi.metric === "leads");
              return lead ? `${lead.actual}/${lead.target}` : "—";
            })()}
          </strong>
        </article>
      </div>

      <div className="split">
        <ApprovalDesk snapshot={snapshot} onAction={handleApprovalAction} />
        <LiveCollaboration snapshot={snapshot} />
      </div>
    </section>
  );

  const renderCampaigns = () => (
    <CampaignBoard snapshot={snapshot} />
  );

  const renderCompetitors = () => (
    <CompetitorList />
  );

  const renderStudio = () => (
    <ContentStudio />
  );

  const views: Record<View, JSX.Element> = {
    office: <AgentOfficeView />,
    dashboard: renderDashboard(),
    campaigns: renderCampaigns(),
    competitors: renderCompetitors(),
    studio: renderStudio(),
    community: <CommunityInbox />,
    operations: <OperationsPanel snapshot={snapshot} />
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span>AM</span>
          <div>
            <strong>Marketing AI</strong>
            <small>Command Center</small>
          </div>
        </div>
        <nav>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={activeView === item.id ? "active" : ""}
                key={item.id}
                onClick={() => setActiveView(item.id)}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>
      <main>
        <header className="topbar">
          <div>
            <p className="eyebrow">AI Marketing Operations · Human approval</p>
            <h2>{navItems.find((item) => item.id === activeView)?.label}</h2>
          </div>
          <button onClick={refresh} title="Tải lại dữ liệu từ Server">
            <RefreshCw size={15} /> Làm mới
          </button>
        </header>
        {views[activeView]}
      </main>
    </div>
  );
}

export default App;

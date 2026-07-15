import {
  Activity,
  Bot,
  BriefcaseBusiness,
  Building2,
  ClipboardList,
  Download,
  FileJson,
  GitBranch,
  LayoutDashboard,
  Plus,
  Play,
  RefreshCw,
  Search,
  Send,
  ShieldCheck
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { seedData } from "./data/seed";
import {
  advanceTaskStatus,
  buildAgentWorkflowDemo,
  createDailyBriefFromData,
  getDashboardStats,
  getRepoDetail,
  runSimulatedAgent,
  taskStatuses
} from "./domain/operations";
import type {
  AgentRecord,
  AppData,
  BusinessArea,
  RepoProvider,
  RepoRecord,
  RepoStatus,
  TaskPriority,
  TaskRecord,
  TaskStatus
} from "./domain/types";
import { exportForLarkBase } from "./integrations/larkAdapter";
import { AgentOfficeView } from "./features/agent-office/AgentOfficeView";

type View = "office" | "dashboard" | "repos" | "tasks" | "agents" | "brief" | "telegram" | "export";

const storageKey = "repoops-ai-command-center-data";
const repoStatuses: RepoStatus[] = ["idea", "active", "paused", "archived"];
const businessAreas: BusinessArea[] = ["marketing", "automation", "AI tool", "internal ops", "research"];
const priorities: TaskPriority[] = ["low", "medium", "high", "urgent"];
const providers: RepoProvider[] = ["GitHub", "GitLab"];

const navItems = [
  { id: "office" as View, label: "Văn phòng Agent", icon: Building2 },
  { id: "dashboard" as View, label: "Dashboard", icon: LayoutDashboard },
  { id: "repos" as View, label: "Repos", icon: GitBranch },
  { id: "tasks" as View, label: "Tasks", icon: ClipboardList },
  { id: "agents" as View, label: "Agents", icon: Bot },
  { id: "brief" as View, label: "Daily Brief", icon: BriefcaseBusiness },
  { id: "telegram" as View, label: "Telegram", icon: Send },
  { id: "export" as View, label: "Data Export", icon: FileJson }
];

function loadInitialData(): AppData {
  const saved = window.localStorage.getItem(storageKey);
  if (!saved) return seedData;

  try {
    return JSON.parse(saved) as AppData;
  } catch {
    return seedData;
  }
}

function saveData(data: AppData) {
  window.localStorage.setItem(storageKey, JSON.stringify(data));
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

function Badge({ value, tone }: { value: string; tone?: string }) {
  return <span className={`badge ${tone ?? value}`}>{statusLabel(value)}</span>;
}

function EmptyState({ title, action }: { title: string; action?: string }) {
  return (
    <div className="empty-state">
      <ShieldCheck size={22} />
      <strong>{title}</strong>
      {action ? <span>{action}</span> : null}
    </div>
  );
}

function App() {
  const [data, setDataState] = useState<AppData>(loadInitialData);
  const [activeView, setActiveView] = useState<View>("office");
  const [selectedRepoId, setSelectedRepoId] = useState(data.repos[0]?.id ?? "");
  const [repoFilter, setRepoFilter] = useState({ query: "", status: "all", agent: "all", area: "all" });
  const [editingRepo, setEditingRepo] = useState<RepoRecord | null>(null);
  const [agentRun, setAgentRun] = useState(data.agentRuns[0]);
  const [workflowTaskId, setWorkflowTaskId] = useState("task-003");
  const [workflowDemo, setWorkflowDemo] = useState(() => buildAgentWorkflowDemo(data, "task-003"));

  const setData = (updater: AppData | ((current: AppData) => AppData)) => {
    setDataState((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      saveData(next);
      return next;
    });
  };

  const stats = useMemo(() => getDashboardStats(data), [data]);
  const selectedRepo = useMemo(() => getRepoDetail(data, selectedRepoId), [data, selectedRepoId]);
  const exported = useMemo(() => exportForLarkBase(data), [data]);

  const filteredRepos = data.repos.filter((repo) => {
    const query = repoFilter.query.toLowerCase();
    const matchesQuery =
      !query ||
      [repo.name, repo.purpose, repo.next_action].some((value) => value.toLowerCase().includes(query));
    return (
      matchesQuery &&
      (repoFilter.status === "all" || repo.status === repoFilter.status) &&
      (repoFilter.agent === "all" || repo.owner_agent === repoFilter.agent) &&
      (repoFilter.area === "all" || repo.business_area === repoFilter.area)
    );
  });

  const upsertRepo = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const repo: RepoRecord = {
      id: String(form.get("id") || `repo-${Date.now()}`),
      name: String(form.get("name")),
      provider: String(form.get("provider")) as RepoProvider,
      url: String(form.get("url")),
      purpose: String(form.get("purpose")),
      business_area: String(form.get("business_area")) as BusinessArea,
      status: String(form.get("status")) as RepoStatus,
      owner_agent: String(form.get("owner_agent")),
      health_score: Number(form.get("health_score") || 75),
      last_activity: new Date().toISOString().slice(0, 10),
      next_action: String(form.get("next_action"))
    };

    setData((current) => ({
      ...current,
      repos: current.repos.some((item) => item.id === repo.id)
        ? current.repos.map((item) => (item.id === repo.id ? repo : item))
        : [repo, ...current.repos]
    }));
    setSelectedRepoId(repo.id);
    setEditingRepo(null);
    event.currentTarget.reset();
  };

  const createTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const task: TaskRecord = {
      id: `task-${Date.now()}`,
      title: String(form.get("title")),
      repo_id: String(form.get("repo_id")),
      status: String(form.get("status")) as TaskStatus,
      priority: String(form.get("priority")) as TaskPriority,
      assigned_agent: String(form.get("assigned_agent")),
      input: String(form.get("input")),
      expected_output: String(form.get("expected_output")),
      quality_gate: String(form.get("quality_gate")),
      evidence: "",
      created_at: new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString().slice(0, 10)
    };

    setData((current) => ({ ...current, tasks: [task, ...current.tasks] }));
    event.currentTarget.reset();
  };

  const updateTaskStatus = (task: TaskRecord, status?: TaskStatus) => {
    const evidence = status ? `Moved to ${status}` : "Advanced one workflow step";
    setData((current) => ({
      ...current,
      tasks: current.tasks.map((item) =>
        item.id === task.id ? advanceTaskStatus(item, status, evidence) : item
      )
    }));
  };

  const simulateAgent = (agent: AgentRecord, task?: TaskRecord) => {
    const targetTask = task ?? data.tasks.find((item) => item.assigned_agent === agent.id) ?? data.tasks[0];
    const run = runSimulatedAgent(agent, targetTask);
    setAgentRun(run);
    setData((current) => ({ ...current, agentRuns: [run, ...current.agentRuns] }));
  };

  const runFullAgentWorkflow = () => {
    const demo = buildAgentWorkflowDemo(data, workflowTaskId);
    setWorkflowDemo(demo);
    setAgentRun(demo.steps[demo.steps.length - 1].run);
    setData((current) => ({
      ...current,
      agentRuns: [...demo.steps.map((step) => step.run).reverse(), ...current.agentRuns]
    }));
  };

  const addRuleBasedBrief = () => {
    const brief = createDailyBriefFromData(data);
    setData((current) => ({ ...current, dailyBriefs: [brief, ...current.dailyBriefs] }));
  };

  const renderDashboard = () => (
    <section className="view-grid">
      <div className="hero-panel">
        <div>
          <p className="eyebrow">RepoOps AI Command Center</p>
          <h1>Một người quản lý nhiều repo và đội AI Agent như một công ty phần mềm thu nhỏ.</h1>
        </div>
        <div className="brief-card">
          <span>Daily brief hôm nay</span>
          <strong>{stats.dailyBrief?.date}</strong>
          <p>{stats.dailyBrief?.suggested_actions[0]}</p>
        </div>
      </div>

      <div className="metric-grid">
        <Metric label="Tổng repo" value={stats.totalRepos} />
        <Metric label="Task đang mở" value={stats.openTasks} />
        <Metric label="Chờ review" value={stats.waitingReview} />
        <Metric label="Repo lỗi build/test" value={stats.failingRepos} tone="danger" />
        <Metric label="Release sẵn sàng" value={stats.releaseReady} tone="ready" />
      </div>

      <div className="split">
        <Panel title="Top 5 task ưu tiên" icon={<ClipboardList size={18} />}>
          <div className="task-list">
            {stats.topPriorityTasks.map((task) => (
              <button className="task-row" key={task.id} onClick={() => setActiveView("tasks")}>
                <span>
                  <strong>{task.title}</strong>
                  <small>{data.repos.find((repo) => repo.id === task.repo_id)?.name}</small>
                </span>
                <Badge value={task.priority} />
                <Badge value={task.status} />
              </button>
            ))}
          </div>
        </Panel>
        <Panel title="Repo health" icon={<Activity size={18} />}>
          <div className="health-stack">
            {data.repos.map((repo) => (
              <button
                className="health-row"
                key={repo.id}
                onClick={() => {
                  setSelectedRepoId(repo.id);
                  setActiveView("repos");
                }}
              >
                <span>{repo.name}</span>
                <meter min="0" max="100" value={repo.health_score} />
                <strong>{repo.health_score}</strong>
              </button>
            ))}
          </div>
        </Panel>
      </div>
    </section>
  );

  const renderRepos = () => (
    <section className="view-grid">
      <Panel title="Repo Registry" icon={<GitBranch size={18} />}>
        <div className="filters">
          <label className="search-box">
            <Search size={16} />
            <input
              value={repoFilter.query}
              onChange={(event) => setRepoFilter({ ...repoFilter, query: event.target.value })}
              placeholder="Tìm repo, mục đích, next action"
            />
          </label>
          <Select value={repoFilter.status} onChange={(value) => setRepoFilter({ ...repoFilter, status: value })}>
            <option value="all">Tất cả status</option>
            {repoStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
          <Select value={repoFilter.area} onChange={(value) => setRepoFilter({ ...repoFilter, area: value })}>
            <option value="all">Tất cả business area</option>
            {businessAreas.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </Select>
          <Select value={repoFilter.agent} onChange={(value) => setRepoFilter({ ...repoFilter, agent: value })}>
            <option value="all">Tất cả agent</option>
            {data.agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </Select>
        </div>

        {filteredRepos.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Repo</th>
                  <th>Provider</th>
                  <th>Area</th>
                  <th>Status</th>
                  <th>Owner</th>
                  <th>Health</th>
                  <th>Next action</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredRepos.map((repo) => (
                  <tr key={repo.id}>
                    <td>
                      <strong>{repo.name}</strong>
                      <small>{repo.purpose}</small>
                    </td>
                    <td>{repo.provider}</td>
                    <td>{repo.business_area}</td>
                    <td><Badge value={repo.status} /></td>
                    <td>{data.agents.find((agent) => agent.id === repo.owner_agent)?.name}</td>
                    <td><strong>{repo.health_score}</strong></td>
                    <td>{repo.next_action}</td>
                    <td>
                      <div className="row-actions">
                        <button onClick={() => setEditingRepo(repo)}>Sửa</button>
                        <button
                          onClick={() => {
                            setSelectedRepoId(repo.id);
                            setActiveView("repos");
                          }}
                        >
                          Chi tiết
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Không có repo phù hợp filter" action="Đổi filter hoặc thêm repo mới." />
        )}
      </Panel>

      <div className="split">
        <Panel title={editingRepo ? "Sửa repo" : "Thêm repo mới"} icon={<Plus size={18} />}>
          <RepoForm repo={editingRepo} agents={data.agents} onSubmit={upsertRepo} />
        </Panel>
        <Panel title="Repo Detail" icon={<ShieldCheck size={18} />}>
          {selectedRepo ? (
            <RepoDetailView detail={selectedRepo} tasks={data.tasks} />
          ) : (
            <EmptyState title="Chưa chọn repo" action="Chọn một repo để xem chi tiết." />
          )}
        </Panel>
      </div>
    </section>
  );

  const renderTasks = () => (
    <section className="view-grid">
      <Panel title="Task Pipeline" icon={<ClipboardList size={18} />}>
        <div className="kanban">
          {taskStatuses.map((status) => {
            const tasks = data.tasks.filter((task) => task.status === status);
            return (
              <div className="kanban-column" key={status}>
                <h3>{statusLabel(status)} <span>{tasks.length}</span></h3>
                {tasks.length ? (
                  tasks.map((task) => (
                    <article className="task-card" key={task.id}>
                      <div>
                        <Badge value={task.priority} />
                        <Badge value={task.status} />
                      </div>
                      <h4>{task.title}</h4>
                      <p>{task.expected_output}</p>
                      <small>{data.agents.find((agent) => agent.id === task.assigned_agent)?.name}</small>
                      <div className="card-actions">
                        <Select
                          value={task.status}
                          onChange={(value) => updateTaskStatus(task, value as TaskStatus)}
                        >
                          {taskStatuses.map((item) => (
                            <option key={item} value={item}>{item}</option>
                          ))}
                        </Select>
                        <button onClick={() => updateTaskStatus(task)}>Next</button>
                      </div>
                    </article>
                  ))
                ) : (
                  <span className="mini-empty">Trống</span>
                )}
              </div>
            );
          })}
        </div>
      </Panel>
      <Panel title="Tạo task" icon={<Plus size={18} />}>
        <TaskForm repos={data.repos} agents={data.agents} onSubmit={createTask} />
      </Panel>
    </section>
  );

  const renderAgents = () => (
    <section className="view-grid">
      <Panel title="Agent Workflow Demo" icon={<Play size={18} />}>
        <div className="workflow-toolbar">
          <div>
            <p className="eyebrow">End-to-end handoff</p>
            <h3>Chạy một task qua đủ 8 Agent như các phòng ban số</h3>
            <p>
              Mỗi Agent tạo record bàn giao có cấu trúc. Hệ thống không tự merge, deploy, publish hoặc sửa repo thật.
            </p>
          </div>
          <div className="workflow-controls">
            <Select
              value={workflowTaskId}
              onChange={(value) => {
                setWorkflowTaskId(value);
                setWorkflowDemo(buildAgentWorkflowDemo(data, value));
              }}
            >
              {data.tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </Select>
            <button className="primary" onClick={runFullAgentWorkflow}>
              <Play size={15} /> Run full agent flow
            </button>
          </div>
        </div>
        <div className="workflow-summary">
          <span>Repo <strong>{workflowDemo.repo?.name ?? workflowDemo.task.repo_id}</strong></span>
          <span>Task <strong>{workflowDemo.task.title}</strong></span>
          <span>Priority <Badge value={workflowDemo.task.priority} /></span>
          <span>Status <Badge value={workflowDemo.task.status} /></span>
        </div>
        <div className="workflow-steps">
          {workflowDemo.steps.map((step, index) => (
            <article className="workflow-step" key={`${step.phase}-${step.agent.id}`}>
              <div className="step-index">{index + 1}</div>
              <div>
                <div className="step-head">
                  <span>{step.phase}</span>
                  <Badge value={step.run.output.recommended_next_status} />
                </div>
                <h4>{step.agent.name}</h4>
                <p>{step.run.output.summary}</p>
                <ul>
                  {step.run.output.handoff_fields.slice(0, 4).map((field) => (
                    <li key={field}>{field}</li>
                  ))}
                </ul>
                <div className="approval-callout compact">
                  <ShieldCheck size={15} />
                  <span>Human approval gate</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </Panel>
      <div className="agent-grid">
        {data.agents.map((agent) => {
          const currentTasks = data.tasks.filter((task) => task.assigned_agent === agent.id);
          return (
            <article className="agent-card" key={agent.id}>
              <div className="agent-head">
                <span>{agent.department}</span>
                <Badge value={agent.status} />
              </div>
              <h3>{agent.name}</h3>
              <p>{agent.mission}</p>
              <div className="schema-grid">
                <div><strong>Input</strong>{agent.input_schema.map((item) => <small key={item}>{item}</small>)}</div>
                <div><strong>Output</strong>{agent.output_schema.map((item) => <small key={item}>{item}</small>)}</div>
              </div>
              <div className="agent-tasks">
                {currentTasks.slice(0, 3).map((task) => (
                  <button key={task.id} onClick={() => simulateAgent(agent, task)}>{task.title}</button>
                ))}
              </div>
              <button className="primary" onClick={() => simulateAgent(agent)}>
                <Send size={15} /> Run simulated agent
              </button>
            </article>
          );
        })}
      </div>
      <Panel title="Agent Runs" icon={<Bot size={18} />}>
        {agentRun ? (
          <div className="run-output">
            <strong>{data.agents.find((agent) => agent.id === agentRun.agent_id)?.name}</strong>
            <p>{agentRun.output.summary}</p>
            <Badge value={agentRun.output.recommended_next_status} />
            <div className="approval-callout">
              <ShieldCheck size={16} />
              <span>{agentRun.output.approval_note}</span>
            </div>
            <ul>
              {agentRun.output.handoff_fields.map((field) => <li key={field}>{field}</li>)}
            </ul>
          </div>
        ) : (
          <EmptyState title="Chưa có agent run" action="Bấm Run simulated agent trên một agent." />
        )}
      </Panel>
    </section>
  );

  const renderBrief = () => (
    <section className="view-grid">
      <Panel title="Daily Brief" icon={<BriefcaseBusiness size={18} />}>
        <div className="panel-actions">
          <button className="primary" onClick={addRuleBasedBrief}><RefreshCw size={15} /> Tạo brief rule-based</button>
        </div>
        <div className="brief-list">
          {data.dailyBriefs.map((brief) => (
            <article className="brief-detail" key={brief.id}>
              <h3>{brief.date}</h3>
              <BriefSection title="Repo cần chú ý" items={brief.attention_repos.map((id) => data.repos.find((repo) => repo.id === id)?.name ?? id)} />
              <BriefSection title="Task ưu tiên" items={brief.priority_tasks.map((id) => data.tasks.find((task) => task.id === id)?.title ?? id)} />
              <BriefSection title="Task bị chặn" items={brief.blocked_tasks.map((id) => data.tasks.find((task) => task.id === id)?.title ?? id)} />
              <BriefSection title="Đề xuất hành động hôm nay" items={brief.suggested_actions} />
              <BriefSection title="Rủi ro" items={brief.risks} />
              <BriefSection title="Kết quả hôm qua" items={brief.yesterday_results} />
            </article>
          ))}
        </div>
      </Panel>
    </section>
  );

  const renderTelegram = () => (
    <section className="view-grid">
      <Panel title="AI Marketing Command Center" icon={<Send size={18} />}>
        <div className="split">
          <div className="brief-detail">
            <h3>Demo operating model</h3>
            <p className="note">
              Telegram là kênh điều hành. Sáu Agent chuyên môn phối hợp theo stage-gate, còn dashboard là bảng quan sát, phê duyệt và kiểm toán local.
            </p>
            <div className="export-grid">
              <article className="export-card">
                <span>Manager</span>
                <strong>1 bot</strong>
                <p>Creates campaigns and keeps approval gates.</p>
              </article>
              <article className="export-card">
                <span>Specialists</span>
                <strong>3 bots</strong>
                <p>Radar, content, and performance brand review.</p>
              </article>
              <article className="export-card">
                <span>Approval</span>
                <strong>Human gate</strong>
                <p>No merge, deploy, release, or publish without approval.</p>
              </article>
              <article className="export-card">
                <span>Runtime</span>
                <strong>Local first</strong>
                <p>Long polling, không cần webhook cho bản chạy local.</p>
              </article>
              <article className="export-card">
                <span>Upgrade</span>
                <strong>API-ready</strong>
                <p>JSON/CSV và Control API sẵn sàng cho tích hợp tiếp theo.</p>
              </article>
            </div>
          </div>
          <Panel title="Commands" icon={<ClipboardList size={18} />}>
            <pre className="csv-preview">{[
              "/brief",
              "/flow",
              "/campaign ra mat dich vu AI Agent cho SME",
              "/trend AI Agent cho SME",
              "/post bai Facebook ve AI Agent",
              "/review noi dung truoc khi dang",
              "/tasks",
              "/approve RUN_ID",
              "/reject RUN_ID",
              "/report"
            ].join("\n")}</pre>
          </Panel>
        </div>
        <div className="split">
          <Panel title="Local setup" icon={<ShieldCheck size={18} />}>
            <pre className="csv-preview">{[
              "1. Tạo 6 bot bằng @BotFather.",
              "2. Add all bots to AI Marketing Command Center.",
              "3. Điền 6 TELEGRAM_*_BOT_TOKEN vào .env.",
              "4. Optional: set TELEGRAM_GROUP_ID and OPERATOR_TELEGRAM_USER_ID.",
              "5. Run: npm run telegram:bot"
            ].join("\n")}</pre>
          </Panel>
          <Panel title="Safety rule" icon={<ShieldCheck size={18} />}>
            <p className="note">
              Agent dùng 9Router khi provider hoạt động và chỉ fallback có ghi nhãn khi API lỗi. Admin phải phê duyệt trước khi chuyển stage; hệ thống không tự chạy ads, chi tiền hoặc deploy.
            </p>
          </Panel>
        </div>
      </Panel>
    </section>
  );

  const renderExport = () => (
    <section className="view-grid">
      <Panel title="Data Export / Integration" icon={<Download size={18} />}>
        <div className="export-grid">
          {Object.entries(exported.json).map(([table, rows]) => (
            <article className="export-card" key={table}>
              <span>{table}</span>
              <strong>{rows.length} records</strong>
              <p>{Object.keys(rows[0] ?? {}).slice(0, 6).join(", ") || "Chưa có record"}</p>
            </article>
          ))}
        </div>
        <div className="code-preview">
          <pre>{JSON.stringify(exported.json, null, 2).slice(0, 4500)}</pre>
        </div>
        <div className="split">
          <Panel title="CSV Repos" icon={<FileJson size={18} />}>
            <pre className="csv-preview">{exported.csv.Repos}</pre>
          </Panel>
          <Panel title="Integration note" icon={<ShieldCheck size={18} />}>
            <p className="note">
              Hệ thống export JSON/CSV để lưu trữ, báo cáo hoặc nối sang dịch vụ ngoài. Luồng Telegram và Meta không phụ thuộc nền tảng quản trị khác.
            </p>
          </Panel>
        </div>
      </Panel>
    </section>
  );

  const views: Record<View, JSX.Element> = {
    office: <AgentOfficeView />,
    dashboard: renderDashboard(),
    repos: renderRepos(),
    tasks: renderTasks(),
    agents: renderAgents(),
    brief: renderBrief(),
    telegram: renderTelegram(),
    export: renderExport()
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span>RO</span>
          <div>
            <strong>RepoOps AI</strong>
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
          <button
            onClick={() => {
              setData(seedData);
              setSelectedRepoId(seedData.repos[0].id);
            }}
          >
            <RefreshCw size={15} /> Reset seed
          </button>
        </header>
        {views[activeView]}
      </main>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <article className={`metric ${tone ?? ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function Panel({ title, icon, children }: { title: string; icon: JSX.Element; children: React.ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-title">
        {icon}
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Select({
  value,
  onChange,
  children,
  name,
  defaultValue
}: {
  value?: string;
  onChange?: (value: string) => void;
  children: React.ReactNode;
  name?: string;
  defaultValue?: string;
}) {
  return (
    <select name={name} value={value} defaultValue={defaultValue} onChange={(event) => onChange?.(event.target.value)}>
      {children}
    </select>
  );
}

function RepoForm({
  repo,
  agents,
  onSubmit
}: {
  repo: RepoRecord | null;
  agents: AgentRecord[];
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <input type="hidden" name="id" value={repo?.id ?? ""} />
      <label>Tên repo<input name="name" required defaultValue={repo?.name ?? ""} /></label>
      <label>URL<input name="url" required defaultValue={repo?.url ?? ""} /></label>
      <label>Provider<Select name="provider" defaultValue={repo?.provider ?? "GitHub"}>{providers.map((item) => <option key={item}>{item}</option>)}</Select></label>
      <label>Business area<Select name="business_area" defaultValue={repo?.business_area ?? "internal ops"}>{businessAreas.map((item) => <option key={item}>{item}</option>)}</Select></label>
      <label>Status<Select name="status" defaultValue={repo?.status ?? "active"}>{repoStatuses.map((item) => <option key={item}>{item}</option>)}</Select></label>
      <label>Owner agent<Select name="owner_agent" defaultValue={repo?.owner_agent ?? agents[0]?.id}>{agents.map((agent) => <option value={agent.id} key={agent.id}>{agent.name}</option>)}</Select></label>
      <label>Health score<input name="health_score" type="number" min="0" max="100" defaultValue={repo?.health_score ?? 75} /></label>
      <label className="wide">Purpose<textarea name="purpose" required defaultValue={repo?.purpose ?? ""} /></label>
      <label className="wide">Next action<textarea name="next_action" required defaultValue={repo?.next_action ?? ""} /></label>
      <button className="primary" type="submit"><Plus size={15} /> Lưu repo</button>
    </form>
  );
}

function TaskForm({
  repos,
  agents,
  onSubmit
}: {
  repos: RepoRecord[];
  agents: AgentRecord[];
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="form-grid task-form" onSubmit={onSubmit}>
      <label>Tiêu đề<input name="title" required /></label>
      <label>Repo<Select name="repo_id" defaultValue={repos[0]?.id}>{repos.map((repo) => <option value={repo.id} key={repo.id}>{repo.name}</option>)}</Select></label>
      <label>Status<Select name="status" defaultValue="idea">{taskStatuses.map((item) => <option key={item}>{item}</option>)}</Select></label>
      <label>Priority<Select name="priority" defaultValue="medium">{priorities.map((item) => <option key={item}>{item}</option>)}</Select></label>
      <label>Agent<Select name="assigned_agent" defaultValue={agents[0]?.id}>{agents.map((agent) => <option value={agent.id} key={agent.id}>{agent.name}</option>)}</Select></label>
      <label className="wide">Input<textarea name="input" required /></label>
      <label className="wide">Expected output<textarea name="expected_output" required /></label>
      <label className="wide">Quality gate<textarea name="quality_gate" required /></label>
      <button className="primary" type="submit"><Plus size={15} /> Tạo task</button>
    </form>
  );
}

function RepoDetailView({ detail }: { detail: ReturnType<typeof getRepoDetail>; tasks: TaskRecord[] }) {
  if (!detail) return null;
  return (
    <div className="repo-detail">
      <h3>{detail.repo.name}</h3>
      <p>{detail.repo.purpose}</p>
      <div className="detail-grid">
        <span>Provider <strong>{detail.repo.provider}</strong></span>
        <span>Status <Badge value={detail.repo.status} /></span>
        <span>Health <strong>{detail.repo.health_score}</strong></span>
      </div>
      <h4>Release readiness</h4>
      <ul>{detail.releaseChecklist.map((item) => <li key={item}>{item}</li>)}</ul>
      <h4>Agent notes</h4>
      <ul>{detail.agentNotes.map((item) => <li key={item}>{item}</li>)}</ul>
      <h4>Timeline</h4>
      <div className="timeline">{detail.timeline.map((item) => <span key={item}>{item}</span>)}</div>
    </div>
  );
}

function BriefSection({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h4>{title}</h4>
      {items.length ? <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p>Không có.</p>}
    </div>
  );
}

export default App;

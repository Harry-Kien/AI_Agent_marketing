import type {
  AgentRecord,
  AgentRunRecord,
  AgentWorkflowStep,
  AppData,
  TaskPriority,
  TaskRecord,
  TaskStatus
} from "../domain/types";
import {
  advanceTaskStatus,
  buildAgentWorkflowDemo,
  getDashboardStats,
  runSimulatedAgent,
  taskStatuses
} from "../domain/operations";
import { exportForLarkBase } from "./larkAdapter";

export interface TelegramCommand {
  command: string;
  args: string[];
  raw: string;
}

export interface PendingApproval {
  run_id: string;
  task_id: string;
  agent_id?: string;
  steps?: AgentWorkflowStep[];
  recommended_next_status: TaskStatus;
  created_at: string;
  source_command: string;
}

export interface TelegramSession {
  data: AppData;
  pendingApprovals: PendingApproval[];
}

export interface TelegramCommandResult {
  session: TelegramSession;
  messages: string[];
}

export type MarketingBotRole =
  | "manager"
  | "market-radar"
  | "content-creator"
  | "creative-production"
  | "performance-brand"
  | "page-growth";

export interface MarketingBotConfig {
  role: MarketingBotRole;
  token: string;
  displayName: string;
  commands: string[];
  shortDescription: string;
  description: string;
}

export interface TelegramBotCommand {
  command: string;
  description: string;
}

export interface MarketingHandoff {
  role: Exclude<MarketingBotRole, "manager">;
  message: string;
}

type EnvLike = Record<string, string | undefined>;

const marketingBotProfiles: Record<
  MarketingBotRole,
  Omit<MarketingBotConfig, "token"> & { envKey: string; agentId: string }
> = {
  manager: {
    role: "manager",
    displayName: "Marketing Manager Bot",
    envKey: "TELEGRAM_MANAGER_BOT_TOKEN",
    agentId: "agent-pm",
    commands: ["brief", "flow", "campaign", "campaigns", "status", "approvals", "audit", "approve", "reject", "revise", "schedule", "confirm", "community", "health", "report", "whoami", "help"],
    shortDescription: "Trưởng phòng marketing AI, điều phối chiến dịch và phê duyệt.",
    description:
      "Trưởng phòng AI Marketing Command Center. Tạo chiến dịch, giao việc cho các bot chuyên môn, theo dõi tiến độ và giữ cổng phê duyệt của con người trước khi đăng, chạy chiến dịch hoặc chi tiền."
  },
  "market-radar": {
    role: "market-radar",
    displayName: "Market Radar Bot",
    envKey: "TELEGRAM_MARKET_RADAR_BOT_TOKEN",
    agentId: "agent-radar",
    commands: ["trend", "competitor", "audience", "insight", "angle", "help"],
    shortDescription: "Agent nghiên cứu thị trường, trend, đối thủ và insight.",
    description:
      "Market Radar Agent cho doanh nghiệp một người. Phân tích xu hướng, nỗi đau khách hàng, khoảng trống đối thủ và góc truyền thông trước khi sản xuất nội dung."
  },
  "content-creator": {
    role: "content-creator",
    displayName: "Content Strategy & Copy Agent",
    envKey: "TELEGRAM_CONTENT_CREATOR_BOT_TOKEN",
    agentId: "agent-docs",
    commands: ["post", "caption", "script", "calendar", "hook", "help"],
    shortDescription: "Agent sáng tạo nội dung: post, caption, hook, script, lịch đăng.",
    description:
      "Content Creator Agent. Biến định hướng chiến dịch thành bản nháp bài viết, caption, hook, kịch bản video ngắn và lịch nội dung, luôn chờ phê duyệt trước khi đăng."
  },
  "creative-production": {
    role: "creative-production",
    displayName: "Creative Production Agent",
    envKey: "TELEGRAM_CREATIVE_PRODUCTION_BOT_TOKEN",
    agentId: "agent-creative",
    commands: ["creative", "visual", "storyboard", "asset", "variant", "help"],
    shortDescription: "Sản xuất creative brief, visual direction, storyboard và biến thể tài sản.",
    description:
      "Creative Production Agent. Chuyển bản nội dung đã duyệt thành visual brief, storyboard, asset checklist và biến thể sáng tạo. Không tự xuất bản hoặc thay đổi nội dung chiến lược."
  },
  "performance-brand": {
    role: "performance-brand",
    displayName: "Brand & Performance Agent",
    envKey: "TELEGRAM_PERFORMANCE_BRAND_BOT_TOKEN",
    agentId: "agent-review",
    commands: ["review", "brandcheck", "cta", "measure", "report", "help"],
    shortDescription: "Agent kiểm duyệt thương hiệu, CTA, chất lượng và KPI.",
    description:
      "Performance Brand Agent. Kiểm tra chất lượng nội dung, giọng thương hiệu, CTA, rủi ro tuân thủ, KPI và hiệu quả chiến dịch."
  },
  "page-growth": {
    role: "page-growth",
    displayName: "Page Growth & Community Agent",
    envKey: "TELEGRAM_PAGE_GROWTH_BOT_TOKEN",
    agentId: "agent-growth",
    commands: ["community", "inbox", "schedule", "publish", "metrics", "help"],
    shortDescription: "Vận hành lịch Page, cộng đồng, inbox, bằng chứng đăng và chỉ số tăng trưởng.",
    description:
      "Page Growth & Community Agent. Chuẩn bị lịch đăng, phân loại bình luận và inbox, thu thập chỉ số. Không tự đăng, xóa, chặn hoặc trả lời nội dung nhạy cảm khi chưa được người quản lý xác nhận."
  }
};

const marketingCommandMenus: Record<MarketingBotRole, TelegramBotCommand[]> = {
  manager: [
    { command: "start", description: "Bắt đầu trung tâm marketing AI" },
    { command: "help", description: "Xem lệnh của bot quản lý" },
    { command: "brief", description: "Xem brief marketing hôm nay" },
    { command: "flow", description: "Xem luồng demo chuẩn" },
    { command: "campaign", description: "Tạo chiến dịch marketing mới" },
    { command: "campaigns", description: "Xem danh sách chiến dịch" },
    { command: "status", description: "Xem trạng thái một chiến dịch" },
    { command: "approvals", description: "Xem các kết quả đang chờ duyệt" },
    { command: "audit", description: "Xem nhật ký một chiến dịch" },
    { command: "tasks", description: "Xem pipeline task marketing" },
    { command: "run", description: "Chạy workflow cho task có sẵn" },
    { command: "approve", description: "Phê duyệt output đang chờ" },
    { command: "reject", description: "Từ chối output đang chờ" },
    { command: "revise", description: "Yêu cầu bot sửa output bị từ chối" },
    { command: "schedule", description: "Tạo bản xem trước lịch đăng" },
    { command: "confirm", description: "Xác nhận xuất bản lần cuối" },
    { command: "community", description: "Xem hàng chờ chăm sóc khách hàng" },
    { command: "health", description: "Kiểm tra tình trạng hệ thống" },
    { command: "whoami", description: "Xem Group ID và User ID để khóa quyền" },
    { command: "report", description: "Xem báo cáo chiến dịch" }
  ],
  "market-radar": [
    { command: "start", description: "Bắt đầu Market Radar Agent" },
    { command: "help", description: "Xem lệnh nghiên cứu thị trường" },
    { command: "trend", description: "Tìm xu hướng thị trường" },
    { command: "competitor", description: "Phân tích đối thủ" },
    { command: "audience", description: "Phân tích khách hàng mục tiêu" },
    { command: "insight", description: "Đề xuất insight chiến dịch" },
    { command: "angle", description: "Đề xuất góc truyền thông" }
  ],
  "content-creator": [
    { command: "start", description: "Bắt đầu Content Creator Agent" },
    { command: "help", description: "Xem lệnh sáng tạo nội dung" },
    { command: "post", description: "Viết bài social" },
    { command: "caption", description: "Tạo caption" },
    { command: "script", description: "Tạo kịch bản video ngắn" },
    { command: "calendar", description: "Tạo lịch nội dung" },
    { command: "hook", description: "Tạo hook mở đầu" }
  ],
  "creative-production": [
    { command: "start", description: "Bắt đầu Creative Production Agent" },
    { command: "help", description: "Xem nghiệp vụ sản xuất sáng tạo" },
    { command: "creative", description: "Tạo creative package" },
    { command: "visual", description: "Tạo visual direction" },
    { command: "storyboard", description: "Tạo storyboard" },
    { command: "asset", description: "Lập asset checklist" },
    { command: "variant", description: "Tạo biến thể creative" }
  ],
  "performance-brand": [
    { command: "start", description: "Bắt đầu Performance Brand Agent" },
    { command: "help", description: "Xem lệnh kiểm duyệt" },
    { command: "review", description: "Review chất lượng nội dung" },
    { command: "brandcheck", description: "Kiểm tra tone thương hiệu" },
    { command: "cta", description: "Gợi ý CTA" },
    { command: "measure", description: "Đo hiệu quả chiến dịch" },
    { command: "report", description: "Tạo báo cáo chiến dịch" }
  ],
  "page-growth": [
    { command: "start", description: "Bắt đầu Page Growth & Community Agent" },
    { command: "help", description: "Xem nghiệp vụ vận hành Page" },
    { command: "community", description: "Phân loại tương tác cộng đồng" },
    { command: "inbox", description: "Xem hàng chờ chăm sóc khách hàng" },
    { command: "schedule", description: "Chuẩn bị lịch đăng chờ duyệt" },
    { command: "publish", description: "Tạo bản xem trước chờ xác nhận" },
    { command: "metrics", description: "Đọc và tóm tắt chỉ số Page" }
  ]
};

const agentAliases: Record<string, string> = {
  pm: "agent-pm",
  ceo: "agent-pm",
  radar: "agent-radar",
  repo: "agent-radar",
  spec: "agent-spec",
  coding: "agent-coding",
  code: "agent-coding",
  review: "agent-review",
  docs: "agent-docs",
  doc: "agent-docs",
  release: "agent-release",
  analytics: "agent-analytics",
  metric: "agent-analytics"
};

const managerOnlyCommands = new Set([
  "brief",
  "flow",
  "campaign",
  "tasks",
  "run",
  "approve",
  "reject",
  "health",
  "newtask",
  "repos",
  "export",
  "agent",
  "whoami"
]);

const priorityByKeyword: Array<[TaskPriority, RegExp]> = [
  ["urgent", /\b(urgent|gap|block|loi|bug|release|deploy|khẩn|khan)\b/i],
  ["high", /\b(spec|readme|review|fix|sua|sửa|demo)\b/i],
  ["medium", /\b(update|docs|brief|task)\b/i]
];

function cloneData(data: AppData): AppData {
  return JSON.parse(JSON.stringify(data)) as AppData;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function now() {
  return new Date().toISOString();
}

function nextTaskStatus(status: TaskStatus): TaskStatus {
  const index = taskStatuses.indexOf(status);
  return taskStatuses[Math.min(index + 1, taskStatuses.length - 1)];
}

function findTask(data: AppData, taskId?: string) {
  if (!taskId) return undefined;
  return data.tasks.find((task) => task.id.toLowerCase() === taskId.toLowerCase());
}

function findAgent(data: AppData, alias?: string) {
  if (!alias) return undefined;
  const normalized = alias.toLowerCase();
  const agentId = agentAliases[normalized] ?? normalized;
  return data.agents.find(
    (agent) =>
      agent.id === agentId ||
      agent.name.toLowerCase() === normalized ||
      agent.name.toLowerCase().includes(normalized)
  );
}

function findRepoId(data: AppData, args: string[]) {
  const fromToken = args.find((arg) => data.repos.some((repo) => repo.id.toLowerCase() === arg.toLowerCase()));
  if (fromToken) return fromToken.toLowerCase();

  const fullText = args.join(" ").toLowerCase();
  const byName = data.repos.find((repo) => fullText.includes(repo.name.toLowerCase()));
  return byName?.id ?? data.repos[0]?.id ?? "repo-001";
}

function inferPriority(text: string): TaskPriority {
  return priorityByKeyword.find(([, pattern]) => pattern.test(text))?.[0] ?? "medium";
}

function formatTask(task: TaskRecord, data: AppData) {
  const repo = data.repos.find((item) => item.id === task.repo_id);
  const agent = data.agents.find((item) => item.id === task.assigned_agent);
  return `${task.id} | ${task.status} | ${task.priority} | ${repo?.name ?? task.repo_id} | ${agent?.name ?? task.assigned_agent} | ${task.title}`;
}

function formatAgentRun(agent: AgentRecord, task: TaskRecord, run: AgentRunRecord) {
  return [
    `${agent.name} đã xử lý ${task.id}: ${task.title}`,
    run.output.summary,
    `Trạng thái đề xuất tiếp theo: ${run.output.recommended_next_status}`,
    `Cổng chất lượng: ${task.quality_gate}`,
    `Phê duyệt: ${run.output.approval_note}`
  ].join("\n");
}

export function createTelegramSession(data: AppData): TelegramSession {
  return {
    data: cloneData(data),
    pendingApprovals: []
  };
}

export function parseTelegramCommand(text: string): TelegramCommand {
  const raw = text.trim();
  if (!raw.startsWith("/")) {
    return { command: "help", args: [], raw: text };
  }

  const [head = "", ...args] = raw.split(/\s+/).filter(Boolean);
  const command = head.replace(/^\//, "").split("@")[0].toLowerCase();
  return { command: command || "help", args, raw };
}

export function handleTelegramCommand(
  session: TelegramSession,
  text: string
): TelegramCommandResult {
  const parsed = parseTelegramCommand(text);
  const handlers: Record<string, () => TelegramCommandResult> = {
    start: () => help(session),
    help: () => help(session),
    brief: () => brief(session),
    repos: () => repos(session),
    tasks: () => tasks(session),
    newtask: () => newTask(session, parsed),
    run: () => runWorkflow(session, parsed),
    agent: () => runAgent(session, parsed),
    approve: () => approve(session, parsed),
    reject: () => reject(session, parsed),
    export: () => exportData(session)
  };

  return (handlers[parsed.command] ?? handlers.help)();
}

export function getMarketingBotConfigsFromEnv(env: EnvLike): MarketingBotConfig[] {
  return Object.values(marketingBotProfiles).map((profile) => {
    const token = env[profile.envKey];
    if (!token) {
      throw new Error(`Missing ${profile.envKey}`);
    }

    return {
      role: profile.role,
      displayName: profile.displayName,
      token,
      commands: profile.commands,
      shortDescription: profile.shortDescription,
      description: profile.description
    };
  });
}

export function getMarketingBotCommandMenus() {
  return marketingCommandMenus;
}

export function getMarketingCampaignHandoffs(topic: string): MarketingHandoff[] {
  return [
    {
      role: "market-radar",
      message: [
        "Market Radar Bot - Nhiệm vụ mới",
        `Nhiệm vụ: nghiên cứu bối cảnh chiến dịch "${topic}".`,
        `Lệnh cần chạy: /trend ${topic}`,
        "Kết quả cần trả: nỗi đau khách hàng, khoảng trống đối thủ, tín hiệu thời điểm và góc truyền thông.",
        "Cổng phê duyệt: insight phải được xem lại trước khi chuyển sang sản xuất nội dung."
      ].join("\n")
    },
    {
      role: "content-creator",
      message: [
        "Content Creator Bot - Nhiệm vụ mới",
        `Nhiệm vụ: biến chiến dịch "${topic}" thành tài sản nội dung.`,
        `Lệnh cần chạy: /post ${topic}`,
        "Kết quả cần trả: hook, bản nháp bài social, CTA và gợi ý biến thể theo kênh.",
        "Cổng phê duyệt: nội dung chỉ là bản nháp cho tới khi Manager phê duyệt."
      ].join("\n")
    },
    {
      role: "creative-production",
      message: [
        "Creative Production Agent - Nhiệm vụ mới",
        `Nhiệm vụ: chuyển nội dung đã duyệt của chiến dịch "${topic}" thành gói sáng tạo.`,
        `Lệnh dự phòng: /creative ${topic}`,
        "Kết quả cần trả: visual direction, storyboard, asset checklist và các biến thể.",
        "Cổng phê duyệt: creative package phải được duyệt trước khi kiểm định thương hiệu."
      ].join("\n")
    },
    {
      role: "performance-brand",
      message: [
        "Performance Brand Bot - Nhiệm vụ mới",
        `Nhiệm vụ: kiểm tra thương hiệu, chất lượng, CTA và KPI cho "${topic}".`,
        `Lệnh cần chạy: /review ${topic}`,
        "Kết quả cần trả: điểm chất lượng, rủi ro thương hiệu, cải thiện CTA và KPI đề xuất.",
        "Cổng phê duyệt: không đăng, không chạy ads, không gửi ra ngoài khi chưa có người duyệt."
      ].join("\n")
    },
    {
      role: "page-growth",
      message: [
        "Page Growth & Community Agent - Nhiệm vụ mới",
        `Nhiệm vụ: chuẩn bị lịch đăng, community inbox và kế hoạch đo lường cho "${topic}".`,
        `Lệnh dự phòng: /schedule ${topic}`,
        "Kết quả cần trả: bản xem trước lịch đăng, hàng chờ tương tác và KPI theo dõi.",
        "Cổng phê duyệt: không tự đăng, trả lời, xóa hay chặn khi chưa có xác nhận của người quản lý."
      ].join("\n")
    }
  ];
}

export function handleMarketingTeamCommand(
  session: TelegramSession,
  text: string,
  role: MarketingBotRole
): TelegramCommandResult {
  const parsed = parseTelegramCommand(text);

  if (role === "manager") {
    if (parsed.command === "help" || parsed.command === "start") return marketingHelp(session, role);
    if (parsed.command === "flow") return marketingFlow(session);
    if (parsed.command === "campaign") return createMarketingCampaign(session, parsed);
    if (parsed.command === "report") return marketingReport(session);
    if (parsed.command === "health") return marketingSessionHealth(session);
    return handleTelegramCommand(session, text);
  }

  const allowed = marketingBotProfiles[role].commands;
  if (!allowed.includes(parsed.command)) {
    if (managerOnlyCommands.has(parsed.command)) {
      return { session, messages: [] };
    }

    return {
      session,
      messages: [
        `${marketingBotProfiles[role].displayName} hỗ trợ: ${allowed.map((command) => `/${command}`).join(", ")}`
      ]
    };
  }

  if (parsed.command === "help" || parsed.command === "start") {
    return marketingHelp(session, role);
  }

  return runMarketingSpecialist(session, parsed, role);
}

function help(session: TelegramSession): TelegramCommandResult {
  return {
    session,
    messages: [
      [
        "RepoOps Manager Bot",
        "Lệnh: /brief, /repos, /tasks, /newtask <tên task> <repo-id>, /run <task-id>, /agent <vai trò> <task-id>, /approve <run-id>, /reject <run-id>, /export",
        "Mô hình: 1 bot quản lý điều phối 8 agent ảo. Mọi hành động code, merge, release, deploy hoặc publish đều cần con người phê duyệt."
      ].join("\n")
    ]
  };
}

function brief(session: TelegramSession): TelegramCommandResult {
  const stats = getDashboardStats(session.data);
  const briefRecord = stats.dailyBrief;
  const priorityTasks = stats.topPriorityTasks.map((task) => `- ${formatTask(task, session.data)}`);

  return {
    session,
    messages: [
      [
        `Daily Brief ${briefRecord?.date ?? today()}`,
        `Repo: ${stats.totalRepos} | Task mở: ${stats.openTasks} | Chờ review: ${stats.waitingReview} | Sẵn sàng release: ${stats.releaseReady}`,
        `Repo cần chú ý: ${briefRecord?.attention_repos.join(", ") ?? "không có"}`,
        "Task ưu tiên:",
        ...priorityTasks,
        "Hành động đề xuất:",
        ...(briefRecord?.suggested_actions.map((item) => `- ${item}`) ?? ["- Xem task ưu tiên cao nhất trước."])
      ].join("\n")
    ]
  };
}

function repos(session: TelegramSession): TelegramCommandResult {
  return {
    session,
    messages: [
      [
        "Danh sách repo",
        ...session.data.repos.map(
          (repo) =>
            `${repo.id} | ${repo.provider} | ${repo.status} | health ${repo.health_score} | ${repo.name}`
        )
      ].join("\n")
    ]
  };
}

function tasks(session: TelegramSession): TelegramCommandResult {
  return {
    session,
    messages: [
      [
        "Task Pipeline",
        "idea -> spec -> issue -> coding -> testing -> review -> ready_to_release -> released -> measured",
        ...session.data.tasks.slice(0, 10).map((task) => formatTask(task, session.data))
      ].join("\n")
    ]
  };
}

function newTask(session: TelegramSession, parsed: TelegramCommand): TelegramCommandResult {
  const text = parsed.args.join(" ").trim();
  if (!text) {
    return {
      session,
      messages: ["Cách dùng: /newtask <tên task> <repo-id>. Ví dụ: /newtask sua README repo-003"]
    };
  }

  const repoId = findRepoId(session.data, parsed.args);
  const title = parsed.args.filter((arg) => arg.toLowerCase() !== repoId.toLowerCase()).join(" ");
  const taskNumber = session.data.tasks.length + 1;
  const task: TaskRecord = {
    id: `tg-task-${String(taskNumber).padStart(3, "0")}`,
    title: title || text,
    repo_id: repoId,
    status: "idea",
    priority: inferPriority(text),
    assigned_agent: "agent-pm",
    input: text,
    expected_output: "Bàn giao agent có cấu trúc và quyết định của người vận hành.",
    quality_gate: "Người vận hành có thể phê duyệt, từ chối hoặc chuyển hướng task.",
    evidence: "",
    created_at: today(),
    updated_at: today()
  };

  const nextSession = {
    ...session,
    data: {
      ...session.data,
      tasks: [task, ...session.data.tasks]
    }
  };

  return {
    session: nextSession,
    messages: [
      [
        `Đã tạo ${task.id}: ${task.title}`,
        `Repo: ${task.repo_id} | Ưu tiên: ${task.priority} | Giao cho: CEO/PM Agent`,
        "Bước tiếp theo: /run " + task.id
      ].join("\n")
    ]
  };
}

function runWorkflow(session: TelegramSession, parsed: TelegramCommand): TelegramCommandResult {
  const task = findTask(session.data, parsed.args[0]);
  if (!task) {
    return { session, messages: ["Không tìm thấy task. Dùng /tasks để lấy đúng task id."] };
  }

  const demo = buildAgentWorkflowDemo(session.data, task.id);
  const runId = `tg-flow-${Date.now()}`;
  const approval: PendingApproval = {
    run_id: runId,
    task_id: task.id,
    steps: demo.steps,
    recommended_next_status: nextTaskStatus(task.status),
    created_at: now(),
    source_command: parsed.raw
  };

  const nextSession = {
    ...session,
    pendingApprovals: [approval, ...session.pendingApprovals]
  };

  return {
    session: nextSession,
    messages: [
      [
        `Đã chạy workflow 8-agent cho ${task.id}: ${task.title}`,
        `Repo: ${demo.repo?.name ?? task.repo_id}`,
        `Agents: ${demo.steps.map((step) => step.agent.name).join(" -> ")}`,
        `Trạng thái đề xuất sau phê duyệt: ${approval.recommended_next_status}`,
        `Cần con người phê duyệt. Duyệt bằng /approve ${runId} hoặc từ chối bằng /reject ${runId}.`
      ].join("\n")
    ]
  };
}

function runAgent(session: TelegramSession, parsed: TelegramCommand): TelegramCommandResult {
  const agent = findAgent(session.data, parsed.args[0]);
  const task = findTask(session.data, parsed.args[1]);

  if (!agent) {
    return { session, messages: ["Không tìm thấy agent. Thử: pm, radar, spec, coding, review, docs, release, analytics."] };
  }
  if (!task) {
    return { session, messages: ["Không tìm thấy task. Cách dùng: /agent spec task-003"] };
  }

  const run = runSimulatedAgent(agent, task);
  const approval: PendingApproval = {
    run_id: run.id,
    task_id: task.id,
    agent_id: agent.id,
    recommended_next_status: run.output.recommended_next_status,
    created_at: run.created_at,
    source_command: parsed.raw
  };
  const nextSession = {
    ...session,
    data: {
      ...session.data,
      agentRuns: [run, ...session.data.agentRuns]
    },
    pendingApprovals: [approval, ...session.pendingApprovals]
  };

  return {
    session: nextSession,
    messages: [
      [
        formatAgentRun(agent, task, run),
        `Duyệt bằng /approve ${run.id} hoặc từ chối bằng /reject ${run.id}.`
      ].join("\n")
    ]
  };
}

function approve(session: TelegramSession, parsed: TelegramCommand): TelegramCommandResult {
  const runId = parsed.args[0];
  const approval = session.pendingApprovals.find((item) => item.run_id === runId);
  if (!approval) {
    return { session, messages: ["Không có output nào đang chờ duyệt với run id này."] };
  }

  const updatedTasks = session.data.tasks.map((task) =>
    task.id === approval.task_id
      ? advanceTaskStatus(
          task,
          approval.recommended_next_status,
          `Telegram approval ${approval.run_id} at ${today()}`
        )
      : task
  );
  const nextSession = {
    ...session,
    data: {
      ...session.data,
      tasks: updatedTasks
    },
    pendingApprovals: session.pendingApprovals.filter((item) => item.run_id !== runId)
  };
  const task = updatedTasks.find((item) => item.id === approval.task_id);

  return {
    session: nextSession,
    messages: [
      `Đã phê duyệt ${approval.run_id}. ${approval.task_id} hiện ở trạng thái ${task?.status ?? approval.recommended_next_status}.`
    ]
  };
}

function reject(session: TelegramSession, parsed: TelegramCommand): TelegramCommandResult {
  const runId = parsed.args[0];
  const approval = session.pendingApprovals.find((item) => item.run_id === runId);
  if (!approval) {
    return { session, messages: ["Không có output nào đang chờ duyệt với run id này."] };
  }

  const reason = parsed.args.slice(1).join(" ").trim();
  if (!reason) {
    return {
      session,
      messages: [`Cần ghi rõ lý do từ chối. Cách dùng: /reject ${approval.run_id} <lý do cần sửa>`]
    };
  }

  const updatedTasks = session.data.tasks.map((task) => {
    if (task.id !== approval.task_id) return task;
    const rejectionEvidence = `Telegram rejection ${approval.run_id}: ${reason}`;
    return {
      ...task,
      evidence: [task.evidence, rejectionEvidence].filter(Boolean).join("\n"),
      updated_at: today()
    };
  });

  return {
    session: {
      ...session,
      data: {
        ...session.data,
        tasks: updatedTasks
      },
      pendingApprovals: session.pendingApprovals.filter((item) => item.run_id !== runId)
    },
    messages: [
      `Đã từ chối ${approval.run_id}. ${approval.task_id} giữ nguyên trạng thái và đã lưu lý do: ${reason}`
    ]
  };
}

function exportData(session: TelegramSession): TelegramCommandResult {
  const exported = exportForLarkBase(session.data);
  return {
    session,
    messages: [
      [
        "Bản export sẵn sàng đưa sang Lark đang có trong dashboard local.",
        `Tables: ${Object.keys(exported.json).join(", ")}`,
        `Rows: Repos ${exported.json.Repos.length}, Tasks ${exported.json.Tasks.length}, Agents ${exported.json.Agents.length}`,
        "Telegram là lớp điều khiển demo; Lark có thể nối sau như cơ sở dữ liệu vận hành."
      ].join("\n")
    ]
  };
}

function createMarketingCampaign(
  session: TelegramSession,
  parsed: TelegramCommand
): TelegramCommandResult {
  const brief = parsed.args.join(" ").trim();
  if (!brief) {
    return {
      session,
      messages: ["Cách dùng: /campaign <mục tiêu chiến dịch>. Ví dụ: /campaign ra mắt dịch vụ AI Agent cho SME"]
    };
  }

  const task = buildMarketingTask(session, {
    title: `Campaign: ${brief}`,
    input: brief,
    assignedAgent: "agent-pm",
    expectedOutput: "Brief chiến dịch, chân dung khách hàng, kế hoạch kênh, người phụ trách và checklist phê duyệt.",
    qualityGate: "Chiến dịch có khách hàng mục tiêu, offer, góc nội dung, CTA, kế hoạch đo lường và cổng phê duyệt."
  });

  return {
    session: prependTask(session, task),
    messages: [
      [
        `Đã tạo chiến dịch: ${task.id}`,
        task.title,
        "Luồng phòng ban tiếp theo:",
        "1. Market Radar Bot: /trend " + brief,
        "2. Content Creator Bot: /post " + brief,
        "3. Performance Brand Bot: /review " + brief,
        "Hệ thống điều phối sẽ gửi nhiệm vụ cho từng bot chuyên môn trong group.",
        "Manager vẫn giữ quyền phê duyệt cuối trước khi đăng hoặc launch."
      ].join("\n")
    ]
  };
}

function marketingHelp(session: TelegramSession, role: MarketingBotRole): TelegramCommandResult {
  const profile = marketingBotProfiles[role];
  return {
    session,
    messages: [
      [
        profile.displayName,
        `Lệnh: ${profile.commands.map((command) => `/${command}`).join(", ")}`,
        "Bot này là một phòng ban trong AI Marketing Command Center."
      ].join("\n")
    ]
  };
}

function marketingFlow(session: TelegramSession): TelegramCommandResult {
  return {
    session,
    messages: [
      [
        "Luồng demo chuẩn",
        "1. Marketing Manager Bot: /campaign ra mat dich vu AI Agent cho SME",
        "2. Market Radar Bot: /trend AI Agent cho SME",
        "3. Content Creator Bot: /post bai Facebook ve AI Agent",
        "4. Performance Brand Bot: /review noi dung truoc khi dang",
        "5. Marketing Manager Bot: /approve RUN_ID",
        "6. Marketing Manager Bot: /report",
        "Luôn cần phê duyệt của con người trước khi đăng, launch, chi tiền hoặc gửi bất kỳ thứ gì ra ngoài Telegram."
      ].join("\n")
    ]
  };
}

function marketingReport(session: TelegramSession): TelegramCommandResult {
  const marketingTasks = session.data.tasks.filter((task) =>
    task.title.toLowerCase().includes("campaign") ||
    task.title.toLowerCase().includes("marketing") ||
    task.input.toLowerCase().includes("campaign")
  );

  return {
    session,
    messages: [
      [
        "Báo cáo Marketing",
        `Task chiến dịch: ${marketingTasks.length}`,
        `Output đang chờ duyệt: ${session.pendingApprovals.length}`,
        ...marketingTasks.slice(0, 5).map((task) => `- ${task.id} | ${task.status} | ${task.title}`)
      ].join("\n")
    ]
  };
}

function marketingSessionHealth(session: TelegramSession): TelegramCommandResult {
  return {
    session,
    messages: [
      [
        "Tình trạng phiên Marketing",
        `Task đang quản lý: ${session.data.tasks.length}`,
        `Output chờ phê duyệt: ${session.pendingApprovals.length}`,
        "Dùng /health trực tiếp trên bot đang chạy để xem tình trạng Telegram và AI Provider."
      ].join("\n")
    ]
  };
}

function runMarketingSpecialist(
  session: TelegramSession,
  parsed: TelegramCommand,
  role: MarketingBotRole
): TelegramCommandResult {
  const topic = parsed.args.join(" ").trim() || "AI Agent service for SME";
  const profile = marketingBotProfiles[role];
  const task = buildMarketingTask(session, {
    title: `${profile.displayName}: ${parsed.command} - ${topic}`,
    input: topic,
    assignedAgent: profile.agentId,
    expectedOutput: marketingExpectedOutput(role, parsed.command),
    qualityGate: marketingQualityGate(role)
  });
  const runId = `mk-${role}-${Date.now()}`;
  const nextSession = prependTask(session, task);
  const approval: PendingApproval = {
    run_id: runId,
    task_id: task.id,
    agent_id: profile.agentId,
    recommended_next_status: role === "market-radar" ? "spec" : "review",
    created_at: now(),
    source_command: parsed.raw
  };

  return {
    session: {
      ...nextSession,
      pendingApprovals: [approval, ...nextSession.pendingApprovals]
    },
    messages: [
      [
        `${profile.displayName} xử lý /${parsed.command}`,
        `Chủ đề: ${topic}`,
        "Kết quả có cấu trúc:",
        ...marketingOutputLines(role, parsed.command, topic),
        `Cổng chất lượng: ${task.quality_gate}`,
        `Phê duyệt: cần người quản lý duyệt trước khi đăng hoặc launch. Dùng /approve ${runId} hoặc /reject ${runId}.`
      ].join("\n")
    ]
  };
}

function buildMarketingTask(
  session: TelegramSession,
  input: {
    title: string;
    input: string;
    assignedAgent: string;
    expectedOutput: string;
    qualityGate: string;
  }
): TaskRecord {
  const taskNumber = session.data.tasks.length + 1;
  return {
    id: `mk-task-${String(taskNumber).padStart(3, "0")}`,
    title: input.title,
    repo_id: "repo-001",
    status: "idea",
    priority: inferPriority(input.input),
    assigned_agent: input.assignedAgent,
    input: input.input,
    expected_output: input.expectedOutput,
    quality_gate: input.qualityGate,
    evidence: "",
    created_at: today(),
    updated_at: today()
  };
}

function prependTask(session: TelegramSession, task: TaskRecord): TelegramSession {
  return {
    ...session,
    data: {
      ...session.data,
      tasks: [task, ...session.data.tasks]
    }
  };
}

function marketingExpectedOutput(role: MarketingBotRole, command: string) {
  const outputs: Record<MarketingBotRole, string> = {
    manager: "Kế hoạch vận hành chiến dịch và bản ghi phê duyệt.",
    "market-radar": "Tín hiệu xu hướng, insight khách hàng, góc đối thủ và cơ hội truyền thông.",
    "content-creator": "Bản nháp nội dung, hook, caption, CTA và biến thể theo kênh.",
    "creative-production": "Visual brief, storyboard, asset checklist và biến thể sáng tạo.",
    "performance-brand": "Review thương hiệu, điểm chất lượng, đề xuất CTA và ghi chú đo lường.",
    "page-growth": "Lịch đăng chờ duyệt, hàng chờ cộng đồng, bằng chứng và KPI tăng trưởng."
  };
  return `${outputs[role]} Command: /${command}.`;
}

function marketingQualityGate(role: MarketingBotRole) {
  const gates: Record<MarketingBotRole, string> = {
    manager: "Có mục tiêu chiến dịch, người phụ trách, thời hạn và phê duyệt của con người.",
    "market-radar": "Insight gắn với nỗi đau khách hàng, khoảng trống đối thủ và hành động kinh doanh.",
    "content-creator": "Nội dung có hook, giá trị, CTA, đúng giọng thương hiệu và không có claim thiếu căn cứ.",
    "creative-production": "Bám nội dung đã duyệt, đủ asset, định dạng và accessibility.",
    "performance-brand": "Output đạt yêu cầu về tone thương hiệu, rủi ro tuân thủ, độ rõ CTA và khả năng đo lường.",
    "page-growth": "Không tự đăng hoặc phản hồi nhạy cảm; mọi hành động ngoài hệ thống có xác nhận."
  };
  return gates[role];
}

function marketingOutputLines(role: MarketingBotRole, command: string, topic: string) {
  if (role === "market-radar") {
    return [
      `Insight: ${topic} nên được định vị quanh việc tiết kiệm thời gian vận hành và giảm rối trong triển khai.`,
      "Khách hàng mục tiêu: doanh nghiệp một người và SME cần một quy trình marketing có thể lặp lại.",
      "Góc truyền thông: trình bày như một command center, không phải chatbot chung chung."
    ];
  }

  if (role === "content-creator") {
    return [
      `Hook: Đừng vận hành marketing bằng ghi chú rời rạc. Hãy biến ${topic} thành một đội AI có quản lý.`,
      "Bản nháp: nêu vấn đề, trình bày luồng 4 bot, rồi mời người xem nhận demo.",
      "CTA: Bình luận 'AGENT' để nhận workflow chiến dịch."
    ];
  }

  if (role === "creative-production") {
    return [
      `Visual direction: minh họa ${topic} như một phòng marketing AI đang vận hành theo stage-gate.`,
      "Storyboard: vấn đề vận hành, đội Agent phối hợp, cổng duyệt của con người, kết quả đo lường.",
      "Asset checklist: ảnh 4:5, 1:1, caption-safe area, alt text và hai biến thể hook."
    ];
  }

  if (role === "page-growth") {
    return [
      `Lịch dự kiến: chuẩn bị bản xem trước cho ${topic}; chưa gửi lên Page.`,
      "Community: FAQ thường gặp có thể soạn nháp; giá, khiếu nại và dữ liệu cá nhân phải chuyển người quản lý.",
      "Đo lường: reach, engagement, CTR, lead đủ điều kiện và thời gian phản hồi."
    ];
  }

  return [
    `Review: output /${command} đủ demo nếu claim cụ thể, có căn cứ và không phóng đại.`,
    "Tone thương hiệu: thực tế, tập trung vào người vận hành, cao cấp nhưng không quá lời.",
    "Chỉ số: theo dõi phản hồi, lead đủ điều kiện, thời gian duyệt nội dung và chuyển đổi chiến dịch."
  ];
}

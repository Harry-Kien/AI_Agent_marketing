import type {
  AgentRecord,
  AgentRunRecord,
  AgentWorkflowDemo,
  AppData,
  DashboardStats,
  RepoDetail,
  TaskPriority,
  TaskRecord,
  TaskStatus
} from "./types";

export const taskStatuses: TaskStatus[] = [
  "idea",
  "spec",
  "issue",
  "coding",
  "testing",
  "review",
  "ready_to_release",
  "released",
  "measured"
];

const priorityRank: Record<TaskPriority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1
};

const agentWorkflow = [
  {
    agentId: "agent-pm",
    phase: "Triage",
    output: "Roadmap priority, business reason, owner, and decision needed today.",
    nextStatus: "spec" as TaskStatus,
    fields: ["Decision: keep this task in the active demo lane", "Owner: human operator approves scope"]
  },
  {
    agentId: "agent-radar",
    phase: "Repo scan",
    output: "Repo health, dependency signal, issue risk, and trend context.",
    nextStatus: "spec" as TaskStatus,
    fields: ["Health snapshot reviewed", "Risk source attached to repo record"]
  },
  {
    agentId: "agent-spec",
    phase: "Specification",
    output: "Clear spec, acceptance criteria, test notes, and handoff fields.",
    nextStatus: "issue" as TaskStatus,
    fields: ["Spec ready for issue creation", "Acceptance criteria mapped to quality gate"]
  },
  {
    agentId: "agent-coding",
    phase: "Implementation plan",
    output: "Implementation checklist, affected files, coding risks, and PR draft notes.",
    nextStatus: "testing" as TaskStatus,
    fields: ["Implementation plan prepared", "No code is changed without operator approval"]
  },
  {
    agentId: "agent-review",
    phase: "Quality review",
    output: "Review findings, test gate, bug list, and release blocker decision.",
    nextStatus: "review" as TaskStatus,
    fields: ["Quality gate checked", "Human reviewer keeps final go/no-go authority"]
  },
  {
    agentId: "agent-docs",
    phase: "Documentation",
    output: "README notes, demo script, changelog entry, and stakeholder explanation.",
    nextStatus: "ready_to_release" as TaskStatus,
    fields: ["Demo script updated", "Mock versus real integration noted"]
  },
  {
    agentId: "agent-release",
    phase: "Release readiness",
    output: "Release checklist, go/no-go recommendation, and rollback note.",
    nextStatus: "released" as TaskStatus,
    fields: ["Release checklist prepared", "Publishing requires explicit human approval"]
  },
  {
    agentId: "agent-analytics",
    phase: "Measurement",
    output: "Metric baseline, cycle-time note, bottleneck, and next experiment.",
    nextStatus: "measured" as TaskStatus,
    fields: ["Metric: cycle time and blocker count", "Next experiment proposed for the operator"]
  }
];

export function getDashboardStats(data: AppData): DashboardStats {
  const topPriorityTasks = [...data.tasks]
    .filter((task) => task.status !== "released" && task.status !== "measured")
    .sort((a, b) => {
      const priorityDiff = priorityRank[b.priority] - priorityRank[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    })
    .slice(0, 5);

  const latestBrief = [...data.dailyBriefs].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )[0];

  const failingRepoIds = new Set(
    data.healthChecks
      .filter((check) =>
        [check.build, check.tests, check.security].some((state) => state === "failing")
      )
      .map((check) => check.repo_id)
  );

  return {
    totalRepos: data.repos.length,
    openTasks: data.tasks.filter(
      (task) => task.status !== "released" && task.status !== "measured"
    ).length,
    waitingReview: data.tasks.filter((task) => task.status === "review").length,
    failingRepos: failingRepoIds.size,
    releaseReady: data.tasks.filter((task) => task.status === "ready_to_release").length,
    dailyBrief: latestBrief,
    topPriorityTasks
  };
}

export function advanceTaskStatus(
  task: TaskRecord,
  nextStatus?: TaskStatus,
  evidence?: string
): TaskRecord {
  const currentIndex = taskStatuses.indexOf(task.status);
  const status = nextStatus ?? taskStatuses[Math.min(currentIndex + 1, taskStatuses.length - 1)];

  if (!taskStatuses.includes(status)) {
    throw new Error(`Unsupported task status: ${status}`);
  }

  const nextEvidence = evidence
    ? [task.evidence, evidence].filter(Boolean).join(" | ")
    : task.evidence;

  return {
    ...task,
    status,
    evidence: nextEvidence,
    updated_at: new Date().toISOString().slice(0, 10)
  };
}

export function runSimulatedAgent(agent: AgentRecord, task: TaskRecord): AgentRunRecord {
  const currentIndex = taskStatuses.indexOf(task.status);
  const recommended = taskStatuses[Math.min(currentIndex + 1, taskStatuses.length - 1)];

  return {
    id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    agent_id: agent.id,
    task_id: task.id,
    created_at: new Date().toISOString(),
    output: {
      summary: `${agent.name} đã xử lý "${task.title}" và tạo handoff có cấu trúc.`,
      recommended_next_status: recommended,
      handoff_fields: [
        `Input: ${task.input}`,
        `Expected output: ${task.expected_output}`,
        `Quality gate: ${task.quality_gate}`
      ],
      risks: task.evidence
        ? ["Cần kiểm tra lại evidence trước khi chuyển trạng thái."]
        : ["Task chưa có evidence, nên bổ sung bằng chứng trước khi duyệt."],
      requires_human_approval: true,
      approval_note:
        "Human approval required before changing repo code, merging, releasing, deploying, or publishing externally."
    }
  };
}

export function buildAgentWorkflowDemo(data: AppData, taskId: string): AgentWorkflowDemo {
  const task = data.tasks.find((item) => item.id === taskId);
  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }

  const repo = data.repos.find((item) => item.id === task.repo_id);
  const steps = agentWorkflow.map((step) => {
    const agent = data.agents.find((item) => item.id === step.agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${step.agentId}`);
    }

    const run = runSimulatedAgent(agent, task);
    return {
      phase: step.phase,
      agent,
      run: {
        ...run,
        output: {
          ...run.output,
          summary: `${agent.name} (${step.phase}) xử lý "${task.title}" cho ${repo?.name ?? task.repo_id}: ${step.output}`,
          recommended_next_status: step.nextStatus,
          handoff_fields: [
            `Repo: ${repo?.name ?? task.repo_id}`,
            `Task: ${task.title}`,
            `Phase output: ${step.output}`,
            ...step.fields,
            `Quality gate: ${task.quality_gate}`
          ],
          risks: [
            ...run.output.risks,
            "Demo flow chỉ tạo record đề xuất, không tự sửa code, merge, deploy hoặc publish."
          ]
        }
      }
    };
  });

  return { task, repo, steps };
}

export function getRepoDetail(data: AppData, repoId: string): RepoDetail | undefined {
  const repo = data.repos.find((item) => item.id === repoId);
  if (!repo) return undefined;

  const tasks = data.tasks.filter((task) => task.repo_id === repoId);
  const health = [...data.healthChecks]
    .filter((check) => check.repo_id === repoId)
    .sort((a, b) => new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime())[0];

  return {
    repo,
    tasks,
    health,
    releaseChecklist: [
      repo.health_score >= 80 ? "Health score đạt ngưỡng demo" : "Cần nâng health score lên 80+",
      tasks.some((task) => task.status === "review") ? "Còn task chờ review" : "Không có review blocker",
      tasks.some((task) => task.status === "ready_to_release")
        ? "Có task sẵn sàng release"
        : "Chưa có task ready_to_release",
      health?.tests === "failing" ? "Tests đang failing, không release" : "Tests không có blocker đỏ"
    ],
    agentNotes: [
      `${repo.owner_agent} đang là owner agent.`,
      repo.next_action,
      health?.summary ?? "Chưa có health snapshot."
    ],
    timeline: tasks
      .slice()
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .map((task) => `${task.updated_at}: ${task.title} -> ${task.status}`)
  };
}

export function createDailyBriefFromData(data: AppData) {
  const stats = getDashboardStats(data);
  const failingRepos = data.repos
    .filter((repo) => data.healthChecks.some((check) => check.repo_id === repo.id && check.tests === "failing"))
    .map((repo) => repo.id);

  return {
    id: `brief-${new Date().toISOString().slice(0, 10)}-local`,
    date: new Date().toISOString().slice(0, 10),
    attention_repos: failingRepos.length ? failingRepos : data.repos.slice(0, 3).map((repo) => repo.id),
    priority_tasks: stats.topPriorityTasks.map((task) => task.id),
    blocked_tasks: data.tasks.filter((task) => task.status === "review" && !task.evidence).map((task) => task.id),
    suggested_actions: [
      "Xử lý repo có test/build lỗi trước.",
      "Chuyển task urgent qua review hoặc ready_to_release.",
      "Bổ sung evidence cho task thiếu bằng chứng."
    ],
    risks: [
      "MVP đang dùng dữ liệu local, chưa phản ánh repo thật.",
      "Agent output là mô phỏng rule-based, chưa gọi LLM."
    ],
    yesterday_results: ["Dữ liệu mẫu đã được tổng hợp thành brief rule-based."]
  };
}

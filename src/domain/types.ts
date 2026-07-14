export type RepoProvider = "GitHub" | "GitLab";
export type RepoStatus = "idea" | "active" | "paused" | "archived";
export type BusinessArea =
  | "marketing"
  | "automation"
  | "AI tool"
  | "internal ops"
  | "research";

export type TaskStatus =
  | "idea"
  | "spec"
  | "issue"
  | "coding"
  | "testing"
  | "review"
  | "ready_to_release"
  | "released"
  | "measured";

export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type AgentStatus = "idle" | "working" | "blocked";
export type HealthState = "passing" | "warning" | "failing";

export interface RepoRecord {
  id: string;
  name: string;
  provider: RepoProvider;
  url: string;
  purpose: string;
  business_area: BusinessArea;
  status: RepoStatus;
  owner_agent: string;
  health_score: number;
  last_activity: string;
  next_action: string;
}

export interface TaskRecord {
  id: string;
  title: string;
  repo_id: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_agent: string;
  input: string;
  expected_output: string;
  quality_gate: string;
  evidence: string;
  created_at: string;
  updated_at: string;
}

export interface AgentRecord {
  id: string;
  name: string;
  department: string;
  mission: string;
  input_schema: string[];
  output_schema: string[];
  current_tasks: string[];
  status: AgentStatus;
}

export interface HealthCheckRecord {
  id: string;
  repo_id: string;
  build: HealthState;
  tests: HealthState;
  docs: HealthState;
  security: HealthState;
  summary: string;
  checked_at: string;
}

export interface DailyBriefRecord {
  id: string;
  date: string;
  attention_repos: string[];
  priority_tasks: string[];
  blocked_tasks: string[];
  suggested_actions: string[];
  risks: string[];
  yesterday_results: string[];
}

export interface AgentRunRecord {
  id: string;
  agent_id: string;
  task_id: string;
  created_at: string;
  output: {
    summary: string;
    recommended_next_status: TaskStatus;
    handoff_fields: string[];
    risks: string[];
    requires_human_approval: boolean;
    approval_note: string;
  };
}

export interface AppData {
  repos: RepoRecord[];
  tasks: TaskRecord[];
  agents: AgentRecord[];
  healthChecks: HealthCheckRecord[];
  dailyBriefs: DailyBriefRecord[];
  agentRuns: AgentRunRecord[];
}

export interface DashboardStats {
  totalRepos: number;
  openTasks: number;
  waitingReview: number;
  failingRepos: number;
  releaseReady: number;
  dailyBrief?: DailyBriefRecord;
  topPriorityTasks: TaskRecord[];
}

export interface RepoDetail {
  repo: RepoRecord;
  tasks: TaskRecord[];
  health?: HealthCheckRecord;
  releaseChecklist: string[];
  agentNotes: string[];
  timeline: string[];
}

export interface AgentWorkflowStep {
  phase: string;
  agent: AgentRecord;
  run: AgentRunRecord;
}

export interface AgentWorkflowDemo {
  task: TaskRecord;
  repo?: RepoRecord;
  steps: AgentWorkflowStep[];
}

import { describe, expect, it } from "vitest";
import { seedData } from "../src/data/seed";
import {
  advanceTaskStatus,
  buildAgentWorkflowDemo,
  getDashboardStats,
  getRepoDetail,
  taskStatuses,
  runSimulatedAgent
} from "../src/domain/operations";
import { exportForLarkBase } from "../src/integrations/larkAdapter";

describe("RepoOps AI Command Center domain", () => {
  it("matches the required operating model and exact agent roster", () => {
    expect(taskStatuses).toEqual([
      "idea",
      "spec",
      "issue",
      "coding",
      "testing",
      "review",
      "ready_to_release",
      "released",
      "measured"
    ]);
    expect(seedData.agents.map((agent) => agent.name)).toEqual([
      "CEO/PM Agent",
      "Repo Radar Agent",
      "Spec Agent",
      "Coding Agent",
      "Review Agent",
      "Docs Agent",
      "Release Agent",
      "Analytics Agent"
    ]);
  });

  it("ships the required MVP seed data", () => {
    expect(seedData.repos).toHaveLength(5);
    expect(seedData.agents).toHaveLength(8);
    expect(seedData.tasks).toHaveLength(20);
    expect(seedData.healthChecks).toHaveLength(5);
    expect(seedData.dailyBriefs).toHaveLength(3);
  });

  it("keeps every task and agent record complete enough for demo handoff", () => {
    for (const task of seedData.tasks) {
      expect(task.repo_id).toBeTruthy();
      expect(task.priority).toBeTruthy();
      expect(task.assigned_agent).toBeTruthy();
      expect(task.input).toBeTruthy();
      expect(task.expected_output).toBeTruthy();
      expect(task.quality_gate).toBeTruthy();
      expect(task.status).toBeTruthy();
      expect(task.created_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(task.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(seedData.repos.some((repo) => repo.id === task.repo_id)).toBe(true);
      expect(seedData.agents.some((agent) => agent.id === task.assigned_agent)).toBe(true);
    }

    for (const agent of seedData.agents) {
      expect(agent.mission).toBeTruthy();
      expect(agent.input_schema.length).toBeGreaterThan(0);
      expect(agent.output_schema.length).toBeGreaterThan(0);
      expect(agent.current_tasks.length).toBeGreaterThan(0);
      expect(agent.status).toBeTruthy();
    }
  });

  it("calculates dashboard metrics from local records", () => {
    const stats = getDashboardStats(seedData);
    expect(stats.totalRepos).toBe(5);
    expect(stats.openTasks).toBeGreaterThan(0);
    expect(stats.waitingReview).toBeGreaterThan(0);
    expect(stats.failingRepos).toBeGreaterThan(0);
    expect(stats.releaseReady).toBeGreaterThan(0);
    expect(stats.topPriorityTasks).toHaveLength(5);
  });

  it("moves a task to the next workflow status and records evidence", () => {
    const task = seedData.tasks.find((item) => item.status === "coding");
    expect(task).toBeDefined();

    const updated = advanceTaskStatus(task!, "testing", "Unit smoke completed");
    expect(updated.status).toBe("testing");
    expect(updated.evidence).toContain("Unit smoke completed");
    expect(new Date(updated.updated_at).getTime()).toBeGreaterThanOrEqual(
      new Date(task!.updated_at).getTime()
    );
  });

  it("builds a repo detail view with tasks, health, notes, and timeline", () => {
    const repo = seedData.repos[0];
    const detail = getRepoDetail(seedData, repo.id);
    expect(detail?.repo.id).toBe(repo.id);
    expect(detail?.tasks.length).toBeGreaterThan(0);
    expect(detail?.health).toBeDefined();
    expect(detail?.releaseChecklist.length).toBeGreaterThan(0);
    expect(detail?.timeline.length).toBeGreaterThan(0);
  });

  it("runs a simulated agent with structured handoff output", () => {
    const agent = seedData.agents.find((item) => item.name.includes("Spec"));
    const task = seedData.tasks.find((item) => item.status === "spec");
    expect(agent).toBeDefined();
    expect(task).toBeDefined();

    const run = runSimulatedAgent(agent!, task!);
    expect(run.agent_id).toBe(agent!.id);
    expect(run.task_id).toBe(task!.id);
    expect(run.output.summary).toContain(task!.title);
    expect(run.output.recommended_next_status).toBeTruthy();
    expect(run.output.handoff_fields.length).toBeGreaterThan(0);
    expect(run.output.requires_human_approval).toBe(true);
    expect(run.output.approval_note).toContain("Human approval");
  });

  it("builds a complete eight-agent workflow demo for one task", () => {
    const task = seedData.tasks.find((item) => item.id === "task-003");
    expect(task).toBeDefined();

    const demo = buildAgentWorkflowDemo(seedData, task!.id);
    expect(demo.task.id).toBe(task!.id);
    expect(demo.steps).toHaveLength(8);
    expect(demo.steps.map((step) => step.agent.name)).toEqual([
      "CEO/PM Agent",
      "Repo Radar Agent",
      "Spec Agent",
      "Coding Agent",
      "Review Agent",
      "Docs Agent",
      "Release Agent",
      "Analytics Agent"
    ]);
    expect(demo.steps.every((step) => step.run.output.requires_human_approval)).toBe(true);
    expect(demo.steps[0].phase).toBe("Triage");
    expect(demo.steps[demo.steps.length - 1].run.output.handoff_fields.join(" ")).toContain("Metric");
  });

  it("exports Lark Base compatible JSON and CSV tables", () => {
    const exported = exportForLarkBase(seedData);
    expect(Object.keys(exported.json)).toEqual([
      "Repos",
      "Tasks",
      "Agents",
      "Agent Runs",
      "Daily Briefs"
    ]);
    expect(exported.json.Repos).toHaveLength(5);
    expect(exported.csv.Repos.split("\n")[0]).toContain("id,name,provider");
    expect(exported.csv.Tasks).toContain("quality_gate");
  });
});

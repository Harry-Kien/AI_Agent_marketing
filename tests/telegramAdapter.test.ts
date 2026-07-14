import { describe, expect, it } from "vitest";
import { seedData } from "../src/data/seed";
import {
  createTelegramSession,
  handleTelegramCommand,
  parseTelegramCommand
} from "../src/integrations/telegramAdapter";

describe("Telegram-first manager bot adapter", () => {
  it("parses command names, arguments, and bot mentions", () => {
    expect(parseTelegramCommand("/run task-003")).toEqual({
      command: "run",
      args: ["task-003"],
      raw: "/run task-003"
    });
    expect(parseTelegramCommand("/agent@RepoOpsBot spec task-003")).toEqual({
      command: "agent",
      args: ["spec", "task-003"],
      raw: "/agent@RepoOpsBot spec task-003"
    });
    expect(parseTelegramCommand("hello")).toEqual({
      command: "help",
      args: [],
      raw: "hello"
    });
  });

  it("answers dashboard commands with demo-ready summaries", () => {
    const session = createTelegramSession(seedData);

    expect(handleTelegramCommand(session, "/brief").messages.join("\n")).toContain("Daily Brief");
    expect(handleTelegramCommand(session, "/repos").messages.join("\n")).toContain("repo-001");
    expect(handleTelegramCommand(session, "/tasks").messages.join("\n")).toContain("task-003");
    expect(handleTelegramCommand(session, "/export").messages.join("\n")).toContain("Lark");
  });

  it("creates a task from Telegram without requiring Lark", () => {
    const session = createTelegramSession(seedData);
    const result = handleTelegramCommand(session, "/newtask sua README repo-003");

    expect(result.session.data.tasks).toHaveLength(seedData.tasks.length + 1);
    const created = result.session.data.tasks[0];
    expect(created.title).toContain("sua README");
    expect(created.repo_id).toBe("repo-003");
    expect(created.assigned_agent).toBe("agent-pm");
    expect(created.status).toBe("idea");
    expect(result.messages.join("\n")).toContain(created.id);
  });

  it("runs the full eight-agent workflow and keeps it waiting for human approval", () => {
    const session = createTelegramSession(seedData);
    const result = handleTelegramCommand(session, "/run task-003");

    expect(result.session.pendingApprovals).toHaveLength(1);
    expect(result.session.pendingApprovals[0].steps).toHaveLength(8);
    expect(result.messages.join("\n")).toContain("workflow 8-agent");
    expect(result.messages.join("\n")).toContain("/approve");
    expect(result.messages.join("\n")).toContain("con người phê duyệt");
  });

  it("runs one virtual agent role by alias", () => {
    const session = createTelegramSession(seedData);
    const result = handleTelegramCommand(session, "/agent spec task-003");

    expect(result.session.pendingApprovals).toHaveLength(1);
    expect(result.session.pendingApprovals[0].agent_id).toBe("agent-spec");
    expect(result.messages.join("\n")).toContain("Spec Agent");
    expect(result.messages.join("\n")).toContain("Phê duyệt");
  });

  it("requires an approval record before approve or reject", () => {
    const session = createTelegramSession(seedData);

    expect(handleTelegramCommand(session, "/approve run-missing").messages.join("\n")).toContain(
      "Không có output"
    );
    expect(handleTelegramCommand(session, "/reject run-missing").messages.join("\n")).toContain(
      "Không có output"
    );
  });

  it("approves a pending run by advancing the related task with evidence", () => {
    const session = createTelegramSession(seedData);
    const runResult = handleTelegramCommand(session, "/agent spec task-003");
    const runId = runResult.session.pendingApprovals[0].run_id;
    const approved = handleTelegramCommand(runResult.session, `/approve ${runId}`);

    const task = approved.session.data.tasks.find((item) => item.id === "task-003");
    expect(task?.status).toBe("issue");
    expect(task?.evidence).toContain("Telegram approval");
    expect(approved.session.pendingApprovals).toHaveLength(0);
    expect(approved.messages.join("\n")).toContain("Đã phê duyệt");
  });

  it("rejects a pending run without changing the task status", () => {
    const session = createTelegramSession(seedData);
    const runResult = handleTelegramCommand(session, "/agent spec task-003");
    const runId = runResult.session.pendingApprovals[0].run_id;
    const rejected = handleTelegramCommand(runResult.session, `/reject ${runId}`);

    const task = rejected.session.data.tasks.find((item) => item.id === "task-003");
    expect(task?.status).toBe("spec");
    expect(rejected.session.pendingApprovals).toHaveLength(0);
    expect(rejected.messages.join("\n")).toContain("Đã từ chối");
  });
});

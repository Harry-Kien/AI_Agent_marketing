# Enterprise Stage-Gate Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng workflow Stage-Gate bền vững cho bốn Telegram marketing bot, có campaign/run xuyên suốt, phê duyệt từng phòng ban, rework, persistence, audit và chống xử lý trùng.

**Architecture:** `marketingWorkflow.ts` là state machine thuần, không gọi Telegram hoặc AI. `telegramStateStore.ts` lưu snapshot atomic. `telegram-bot.ts` chỉ làm I/O, serialized command processing và gọi AI theo run mà workflow engine tạo ra.

**Tech Stack:** TypeScript, Node.js filesystem, Telegram Bot API, 9Router/OpenAI-compatible API, Vitest.

## Global Constraints

- Giữ đúng 4 bot Telegram hiện tại.
- Không thêm Lark vào runtime.
- Không tự publish, chạy ads, deploy hoặc merge.
- Chỉ output đã duyệt được truyền sang stage kế tiếp.
- Không commit `.env`, token, runtime snapshot hoặc log.
- Mọi mutation phải được persist trước khi xác nhận thành công.

---

### Task 1: Pure Marketing Stage-Gate State Machine

**Files:**
- Create: `src/integrations/marketingWorkflow.ts`
- Create: `tests/marketingWorkflow.test.ts`

**Interfaces:**
- Produces: `MarketingWorkflowState`, `MarketingCampaignRuntime`, `MarketingAgentRunRuntime`, `createCampaign`, `completeRun`, `approveRun`, `rejectRun`, `reviseRun`, `buildStageInput`, `listPendingRuns`, `getCampaignTimeline`.
- Consumes: no I/O dependency.

- [ ] **Step 1: Write failing lifecycle tests**

Test one complete campaign: create returns Research run; complete -> pending; approve -> Content; approve Content -> Brand; approve Brand -> Final; approve Final -> `ready_to_execute`.

- [ ] **Step 2: Run RED test**

Run: `npx vitest run tests/marketingWorkflow.test.ts --config vitest.config.ts`

Expected: FAIL because `marketingWorkflow.ts` does not exist.

- [ ] **Step 3: Implement workflow types and transitions**

Implement immutable transitions with stage/status guards, stable `CMP-*` and `RUN-*` IDs, bounded audit events and one `activeRunId` per campaign.

- [ ] **Step 4: Add failing rejection, revision and idempotency tests**

Cover required rejection reason, revision `parentRunId`, old run retained, duplicate approve not creating a second next-stage run, and approved-only context.

- [ ] **Step 5: Implement rework and query helpers**

Implement `/approvals`, `/status` and `/audit` data sources as pure query functions.

- [ ] **Step 6: Run GREEN test**

Run: `npx vitest run tests/marketingWorkflow.test.ts --config vitest.config.ts`

Expected: all workflow tests pass.

### Task 2: Atomic Runtime Persistence and Recovery

**Files:**
- Create: `src/integrations/telegramStateStore.ts`
- Create: `tests/telegramStateStore.test.ts`
- Modify: `.gitignore`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `TelegramSession`, `MarketingWorkflowState`.
- Produces: `TelegramRuntimeSnapshot`, `createRuntimeSnapshot`, `loadRuntimeSnapshot`, `saveRuntimeSnapshot`, `hasProcessedUpdate`, `markUpdateProcessed`.

- [ ] **Step 1: Write failing snapshot tests**

Cover round-trip persistence, offsets, processed IDs, bounds (1,000 update IDs), corrupt snapshot quarantine and fallback state.

- [ ] **Step 2: Run RED test**

Run: `npx vitest run tests/telegramStateStore.test.ts --config vitest.config.ts`

Expected: FAIL because `telegramStateStore.ts` does not exist.

- [ ] **Step 3: Implement atomic store**

Write `<path>.tmp`, rename atomically, validate `schemaVersion: 1`, quarantine corrupt JSON and never serialize command queues or secrets.

- [ ] **Step 4: Run GREEN test**

Run: `npx vitest run tests/telegramStateStore.test.ts --config vitest.config.ts`

Expected: all store tests pass.

### Task 3: Enterprise Commands and Formatting

**Files:**
- Modify: `src/integrations/telegramAdapter.ts`
- Modify: `src/integrations/telegramRuntime.ts`
- Modify: `tests/marketingTelegramTeam.test.ts`
- Modify: `tests/telegramRuntime.test.ts`

**Interfaces:**
- Produces command menus for `/campaigns`, `/status`, `/approvals`, `/audit`, `/revise` and Vietnamese formatters for campaign/run/timeline.
- Consumes workflow query results from Task 1.

- [ ] **Step 1: Write failing command menu and formatter tests**

Assert Manager menu contains all enterprise commands and formatters include campaign ID, current stage, pending run, next action and no secret.

- [ ] **Step 2: Run RED test**

Run: `npx vitest run tests/marketingTelegramTeam.test.ts tests/telegramRuntime.test.ts --config vitest.config.ts`

Expected: FAIL for missing commands/formatters.

- [ ] **Step 3: Implement menus and formatters**

Keep existing direct specialist commands compatible; manager-only enterprise commands never execute on specialist bots.

- [ ] **Step 4: Run GREEN test**

Run the same command and expect all tests pass.

### Task 4: Serialized Telegram Orchestration

**Files:**
- Modify: `scripts/telegram-bot.ts`
- Modify: `src/integrations/aiProvider.ts`
- Modify: `tests/aiProvider.test.ts`

**Interfaces:**
- Consumes workflow/state-store interfaces from Tasks 1-2.
- Produces serialized Stage-Gate command handling and stage-specific AI execution.

- [ ] **Step 1: Add stage-specific prompt tests**

Verify finalizer prompt uses only approved Research, Content and Brand packages; revision prompt contains feedback and prior output.

- [ ] **Step 2: Run RED test**

Run: `npx vitest run tests/aiProvider.test.ts --config vitest.config.ts`

Expected: FAIL for missing stage context requirements.

- [ ] **Step 3: Implement runtime orchestration**

Handle `/campaign`, `/approve`, `/reject`, `/revise`, `/campaigns`, `/status`, `/approvals`, `/audit`, `/report`; execute only the active run; persist before confirmation; serialize mutations; store offsets and processed update IDs.

- [ ] **Step 4: Preserve direct commands**

Keep `/trend`, `/post`, `/review`, `/brief`, `/health`, `/whoami` working outside a campaign without bypassing authorization.

- [ ] **Step 5: Run typecheck and focused regression tests**

Run: `npm run typecheck` and `npm run test`.

Expected: no TypeScript errors; all tests pass.

### Task 5: Operational Documentation and Delivery

**Files:**
- Modify: `README.md`
- Modify: `docs/PHAN_CONG_2_NGUOI_TELEGRAM_AGENT_MARKETING_KHOA_LUAN.md`
- Create: `docs/handoffs/2026-07-14-owner-a-stage-gate-runtime.md`

**Interfaces:**
- Consumes verified runtime behavior.
- Produces exact demo script and OWNER-B handoff contract.

- [ ] **Step 1: Update operator documentation**

Document four visible bots, internal skill map, Stage-Gate commands, restart recovery, state path, rework and final approval semantics.

- [ ] **Step 2: Run full verification**

Run: `npm run check`, `npm run smoke` with dashboard on port 5174, `npm run telegram:setup`, live 9Router request and bot startup.

- [ ] **Step 3: Security and repository checks**

Run `git diff --check`, scan staged files for Telegram/OpenAI token patterns, verify `.env` and runtime state are ignored.

- [ ] **Step 4: Commit and push**

Use focused Conventional Commits, push `codex/owner-a-telegram-runtime`, keep it unmerged for OWNER-B review.

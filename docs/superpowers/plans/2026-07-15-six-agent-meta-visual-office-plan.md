# Six-Agent Meta Marketing Office Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the maintained Telegram marketing runtime into `C:\Users\KIÊN\Downloads\AIAGENTSME` and deliver six role-separated agents, natural-language admin control, guarded Meta Page operations, customer-care triage, and a realtime Visual Agent Office.

**Architecture:** Keep one Node/TypeScript orchestrator as the source of truth. Domain modules own workflow, intent, Meta policy, and persistence; Telegram and the local HTTP/SSE control API are adapters. The React dashboard consumes the API and never reads runtime files or secrets directly.

**Tech Stack:** TypeScript 5, Node.js, Telegram Bot API, Meta Graph API v23.0, React 18, Vite 6, Vitest, Playwright, atomic local JSON persistence, HTTP/SSE.

## Global Constraints

- Six visible Telegram identities: manager, market intelligence, content strategy/copy, creative production, brand/performance, page growth/community.
- Only the configured operator and group may mutate workflow state.
- Natural-language confidence below `0.82` must ask for clarification instead of mutating state.
- Real Meta publishing remains disabled until exposed credentials are rotated and `META_PUBLISH_ENABLED=true` is explicitly set.
- Customer auto-reply remains disabled by default and never handles pricing, personal data, complaints, legal/security, or unclear messages.
- No automatic ads, budget changes, comment deletion/blocking, merge, deploy, or social publishing without human confirmation.
- Secrets, runtime state, logs, screenshots, `node_modules`, and build artifacts are never committed.
- All manual source edits use `apply_patch`; migration uses a verified single-shell copy operation with a backup outside the target workspace.

---

### Task 1: Safe Workspace Migration and Git Repair

**Files:**
- Copy: maintained source tree from `C:\Users\KIÊN\Downloads\AI_Agent_marketing`
- Preserve: `C:\Users\KIÊN\Downloads\AIAGENTSME\.env`
- Create: `C:\Users\KIÊN\Downloads\AIAGENTSME\docs\migration\2026-07-15-migration-report.md`

**Interfaces:**
- Consumes: source branch `codex/owner-a-telegram-runtime` at commit containing this plan.
- Produces: standalone target Git repository with the same tracked source and a clean working tree baseline.

- [ ] Verify source and target absolute paths and create a timestamped sibling backup of the target.
- [ ] Copy source files while excluding `.git`, `.env`, `node_modules`, `dist`, and `output`; preserve target-only documentation in the backup.
- [ ] Initialize target `.git`, set `origin` to `https://github.com/Harry-Kien/AI_Agent_marketing.git`, and create branch `codex/six-agent-meta-office`.
- [ ] Install dependencies and verify baseline tests/typecheck/build before feature changes.
- [ ] Record source commit, backup path, exclusions, and baseline results in the migration report.
- [ ] Commit with `chore: migrate maintained runtime to AIAGENTSME`.

### Task 2: Six-Agent Contracts and Extended Stage-Gate

**Files:**
- Modify: `src/integrations/telegramAdapter.ts`
- Modify: `src/integrations/marketingWorkflow.ts`
- Modify: `src/integrations/aiProvider.ts`
- Modify: `src/integrations/telegramRuntime.ts`
- Test: `tests/marketingWorkflow.test.ts`
- Test: `tests/marketingTelegramTeam.test.ts`
- Test: `tests/aiProvider.test.ts`

**Interfaces:**
- Consumes: existing `MarketingBotRole`, `MarketingWorkflowState`, and approval transition functions.
- Produces: `creative-production` and `page-growth` roles; stages `creative`, `publication`; six bot configs and prompts.

- [ ] Add failing tests asserting six bot configs, role-specific menus, and no duplicate role responsibilities.
- [ ] Add failing workflow tests for Content approval creating Creative, Creative approval creating Brand, Final approval creating `ready_to_schedule`, and publication confirmation producing `published`.
- [ ] Extend `MarketingBotRole`, role profiles, command menus, prompt boundaries, stage/role maps, campaign states, run stages, audit actions, and input construction.
- [ ] Add publication draft/confirmation types without calling Meta from the pure state machine.
- [ ] Run focused tests and typecheck.
- [ ] Commit with `feat(workflow): extend stage-gate to six marketing agents`.

### Task 3: Natural-Language Manager Intent Router

**Files:**
- Create: `src/integrations/managerIntent.ts`
- Create: `tests/managerIntent.test.ts`
- Modify: `scripts/telegram-bot.ts`
- Modify: `src/integrations/aiProvider.ts`

**Interfaces:**
- Produces:

```ts
export interface IntentDecision {
  intent: ManagerIntent;
  confidence: number;
  campaignId?: string;
  runId?: string;
  reason?: string;
  requestedAt?: string;
}

export function resolveManagerIntent(
  text: string,
  context: ManagerConversationContext
): Promise<IntentDecision>;
```

- [ ] Write deterministic tests for Vietnamese create/status/approvals/approve/reject/revise/schedule/confirm/customer-inbox phrases.
- [ ] Test ambiguity: plain `Duyệt` with zero or multiple pending runs returns `unclear`; one pending run resolves safely.
- [ ] Implement rule-first parsing for high-confidence operational phrases and model-assisted structured parsing for open-ended text.
- [ ] Validate model JSON, clamp confidence, reject unknown IDs, and ask clarification below `0.82`.
- [ ] Route natural messages through the same pure workflow functions used by slash fallback commands.
- [ ] Add Telegram inline buttons for approve, reject, revise detail, and final publication confirmation.
- [ ] Run focused and regression tests.
- [ ] Commit with `feat(telegram): add natural-language manager control`.

### Task 4: Meta Graph Adapter and Customer-Care Policy

**Files:**
- Create: `src/integrations/metaGraphAdapter.ts`
- Create: `src/integrations/customerCarePolicy.ts`
- Create: `tests/metaGraphAdapter.test.ts`
- Create: `tests/customerCarePolicy.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces:

```ts
export interface MetaGraphClient {
  checkPageIdentity(): Promise<MetaPageIdentity>;
  buildPublicationPreview(input: PublicationInput): PublicationPreview;
  publish(input: ConfirmedPublicationInput): Promise<MetaPublicationEvidence>;
  readPostMetrics(postId: string): Promise<MetaPostMetrics>;
}

export function decideCustomerCareAction(
  interaction: CustomerInteraction,
  knowledgeBase: ApprovedFaq[]
): CustomerCareDecision;
```

- [ ] Test config validation, URL/version construction, timeout, retry, sanitized errors, and idempotency headers/keys.
- [ ] Test dry-run preview and hard block when `META_PUBLISH_ENABLED` is false or final approval evidence is absent.
- [ ] Test customer classes and ensure only approved FAQ can auto-reply when the feature flag is enabled.
- [ ] Implement read-only Page identity check, publication preview, guarded publish, metrics read, and webhook signature helpers.
- [ ] Add environment documentation without real values.
- [ ] Run tests and secret scan.
- [ ] Commit with `feat(meta): add guarded Page and customer-care adapters`.

### Task 5: Runtime Repository and Local Control API

**Files:**
- Create: `src/integrations/runtimeRepository.ts`
- Create: `src/integrations/controlApi.ts`
- Create: `tests/controlApi.test.ts`
- Modify: `src/integrations/telegramStateStore.ts`
- Modify: `scripts/telegram-bot.ts`

**Interfaces:**
- Produces `GET /api/health`, `/api/runtime`, `/api/campaigns`, `/api/approvals`, `/api/audit`, `/api/community`, `/api/events` and guarded local mutation routes.

- [ ] Write API tests for health/runtime read models, localhost binding, bearer token rejection, approve/reject/revise, and SSE event shape.
- [ ] Add repository abstraction around the existing atomic JSON store.
- [ ] Add local HTTP server on `127.0.0.1:8787` with CORS restricted to configured local dashboard origins.
- [ ] Broadcast immutable activity events after persisted mutations.
- [ ] Ensure API responses redact secrets, prompts, and unnecessary personal data.
- [ ] Run API, persistence, and workflow tests.
- [ ] Commit with `feat(runtime): expose secured realtime control API`.

### Task 6: Visual Agent Office

**Files:**
- Create: `src/features/agent-office/AgentOfficeView.tsx`
- Create: `src/features/agent-office/WorkflowGraph.tsx`
- Create: `src/features/agent-office/LiveCollaboration.tsx`
- Create: `src/features/agent-office/ApprovalDesk.tsx`
- Create: `src/features/agent-office/CommunityInbox.tsx`
- Create: `src/features/agent-office/OperationsPanel.tsx`
- Create: `src/features/agent-office/api.ts`
- Create: `src/features/agent-office/types.ts`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Test: `tests/agentOffice.test.tsx`
- Modify: `scripts/smoke-agent-flow.cjs`

**Interfaces:**
- Consumes: local control API read models and SSE activity events.
- Produces: operational dashboard views for six agents, workflow, approvals, campaigns, community, health, audit, and KPI.

- [ ] Write component tests for six-agent roster, status states, pending approval, offline API, empty community inbox, and activity event rendering.
- [ ] Implement a dense operational shell with tabs, stable responsive layout, lucide icons, tooltips, and no nested decorative cards.
- [ ] Implement six fixed agent workstations with role, active task, campaign, latency, and state.
- [ ] Implement SVG/HTML workflow graph with current stage, approval gate, rework branch, and publication state.
- [ ] Implement live collaboration timeline and persisted audit correlation.
- [ ] Implement approval, community, and operations panels with clear disabled/offline states.
- [ ] Add desktop and mobile Playwright checks for overflow, overlap, blank graph, interactions, and API-offline recovery.
- [ ] Commit with `feat(dashboard): add realtime visual agent office`.

### Task 7: Six-Bot Orchestrator Integration

**Files:**
- Modify: `scripts/telegram-bot.ts`
- Modify: `scripts/telegram-setup.ts`
- Modify: `src/integrations/telegramRuntime.ts`
- Test: `tests/telegramRuntime.test.ts`
- Test: `tests/marketingTelegramTeam.test.ts`

**Interfaces:**
- Consumes: six-agent workflow, intent router, Meta adapter, policy, repository, and control API.
- Produces: six long-polling bot identities driven by one serialized orchestrator.

- [ ] Add role-specific offset and processed-update keys for both new bots.
- [ ] Execute the next workflow run only after the preceding approval was persisted.
- [ ] Add typing/activity events without using Telegram as the internal message bus.
- [ ] Integrate publication preview, explicit final confirmation, evidence persistence, and metrics follow-up.
- [ ] Integrate customer interaction triage and escalation with auto-reply feature flag default off.
- [ ] Configure six profiles and command fallbacks through Telegram setup.
- [ ] Run all Telegram regression tests and a mocked full sequence integration test.
- [ ] Commit with `feat(telegram): orchestrate six-agent marketing department`.

### Task 8: Local Secrets, Live Connectivity, Documentation, and Release Verification

**Files:**
- Modify local only: `.env`
- Modify: `README.md`
- Create: `docs/operations/SIX_AGENT_SEQUENCE_DEMO.md`
- Create: `docs/operations/META_PRODUCTION_READINESS.md`
- Create: `docs/handoffs/2026-07-15-six-agent-office.md`

**Interfaces:**
- Produces: runnable local system, operator demo script, production blocker list, and Git handoff.

- [ ] Insert the two new Telegram credentials and temporary Page credentials into local `.env` without printing or committing values.
- [ ] Verify six Telegram bot identities with `getMe` and apply profile/menu setup.
- [ ] Run a read-only Meta Page identity/capability check; do not publish with exposed credentials.
- [ ] Document the exact additional Meta App/Webhook inputs required for customer care and production publishing.
- [ ] Run `npm test`, `npm run typecheck`, `npm run build`, and browser smoke tests.
- [ ] Start the final dashboard, control API, 9Router, and six-bot service on non-conflicting local ports.
- [ ] Run secret scan, `git diff --check`, and verify the target Git root/remote/branch.
- [ ] Commit documentation, push `codex/six-agent-meta-office`, and provide the local URL plus a complete natural-language sequence demo.

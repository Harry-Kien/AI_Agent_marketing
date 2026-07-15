# Enterprise Risk-Based Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép Research, Content, Creative và Brand tự bàn giao nội bộ theo policy; Admin chỉ duyệt Final Package và xác nhận xuất bản.

**Architecture:** Giữ state machine hiện tại làm nguồn sự thật, bổ sung một policy engine thuần quyết định `auto_approve`, `auto_revise`, `escalate` hoặc `human_approval` từ AgentWorkProduct đã qua Zod. Telegram orchestrator áp dụng quyết định, ghi audit có actor rõ ràng và tiếp tục stage; không dùng Telegram bot-to-bot làm message bus.

**Tech Stack:** TypeScript, Zod, Vitest, Telegram Bot API, React/Vite dashboard, local atomic JSON runtime.

## Global Constraints

- `enterprise-risk-based` là mặc định; `strict-stage-gate` giữ hành vi cũ.
- Research, Content, Creative và Brand có thể tự bàn giao; Final luôn chờ Admin.
- Publication luôn cần xác nhận riêng của Admin.
- Output fallback/mock, sai schema hoặc có rủi ro nhạy cảm không được tự duyệt.
- Auto-revision tối đa một lần cho mỗi stage.
- Không tự chạy ads, chi tiền, xóa/chặn hoặc xử lý tình huống CSKH nhạy cảm.

---

### Task 1: Giữ AgentWorkProduct có cấu trúc trong AI result

**Files:**
- Modify: `src/integrations/aiProvider.ts`
- Test: `tests/aiProvider.test.ts`

**Interfaces:**
- Produces: `MarketingAgentOutput.product?: AgentWorkProduct`
- Produces: `MarketingAgentOutput.mode: "ai" | "mock"`

- [ ] **Step 1: Viết test thất bại**

Thêm assertion rằng output AI hợp lệ trả `product.quality_score` và `product.recommendation`; output fallback cũng có product nhưng vẫn có `fallbackReason`.

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npm test -- tests/aiProvider.test.ts`
Expected: FAIL vì `product` chưa tồn tại.

- [ ] **Step 3: Trả product cùng text**

```ts
export interface MarketingAgentOutput {
  mode: "ai" | "mock";
  text: string;
  product: AgentWorkProduct;
  fallbackReason?: string;
}
```

Đổi `buildMockOutput` thành hàm trả `AgentWorkProduct`; format text tại nơi tạo result.

- [ ] **Step 4: Chạy test**

Run: `npm test -- tests/aiProvider.test.ts`
Expected: PASS.

### Task 2: Policy engine thuần và cấu hình approval mode

**Files:**
- Create: `src/integrations/approvalPolicy.ts`
- Create: `tests/approvalPolicy.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `createApprovalPolicyConfig(env): ApprovalPolicyConfig`
- Produces: `evaluateApprovalPolicy(input): ApprovalPolicyDecision`

- [ ] **Step 1: Viết test ma trận policy**

Test các trường hợp: strict gate; final human approval; AI score 85 approve tự bàn giao; fallback escalation; score 70 revise lần đầu; revision lần hai escalation; risk chứa giá/pháp lý/dữ liệu cá nhân escalation.

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npm test -- tests/approvalPolicy.test.ts`
Expected: FAIL vì module chưa tồn tại.

- [ ] **Step 3: Cài đặt policy**

```ts
export type ApprovalMode = "enterprise-risk-based" | "strict-stage-gate";
export type ApprovalPolicyAction = "auto_approve" | "auto_revise" | "escalate" | "human_approval";

export interface ApprovalPolicyDecision {
  action: ApprovalPolicyAction;
  reason: string;
  feedback?: string;
}
```

Thứ tự quyết định: strict -> final -> fallback/mock -> sensitive risk -> approve >= 80 -> revise một lần -> escalation.

- [ ] **Step 4: Chạy test**

Run: `npm test -- tests/approvalPolicy.test.ts`
Expected: PASS.

### Task 3: Audit phân biệt tự duyệt và người duyệt

**Files:**
- Modify: `src/integrations/marketingWorkflow.ts`
- Test: `tests/marketingWorkflow.test.ts`

**Interfaces:**
- Extends: `approveRun(..., options?: { actorType?: "human" | "system"; auditAction?: MarketingAuditAction })`
- Extends: `rejectRun(..., options?: { actorType?: "human" | "system"; auditAction?: MarketingAuditAction })`
- Adds audit actions: `run_auto_approved`, `auto_revision_started`, `risk_escalated`.

- [ ] **Step 1: Viết test audit actor**

Test policy-engine approval tạo event actorType `system`, action `run_auto_approved`, đồng thời vẫn tạo next run đúng stage.

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npm test -- tests/marketingWorkflow.test.ts`
Expected: FAIL vì options/action chưa tồn tại.

- [ ] **Step 3: Mở rộng transition có backward compatibility**

Giữ mặc định actorType `human` và action `run_approved` để strict mode và lệnh Admin không đổi hành vi.

- [ ] **Step 4: Chạy test**

Run: `npm test -- tests/marketingWorkflow.test.ts`
Expected: PASS.

### Task 4: Telegram auto-handoff và auto-revision

**Files:**
- Modify: `scripts/telegram-bot.ts`
- Create: `tests/enterpriseSequence.test.ts`

**Interfaces:**
- Consumes: `MarketingAgentOutput.product`
- Consumes: `evaluateApprovalPolicy`
- Produces: recursive stage execution bounded by five stages plus one revision per stage.

- [ ] **Step 1: Viết enterprise sequence test**

Mô phỏng năm stage với product score 85/recommendation approve; Research đến Brand được policy auto-approve, Final giữ pending approval. Assert chỉ có một pending run và actor auto approvals là `policy-engine`.

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npm test -- tests/enterpriseSequence.test.ts`
Expected: FAIL vì policy orchestration chưa được nối.

- [ ] **Step 3: Áp dụng decision trong `runWorkflowStage`**

Sau `completeRun`:

```ts
const decision = evaluateApprovalPolicy({
  config: createApprovalPolicyConfig(process.env),
  stage: completedRun.stage,
  product: output.product,
  outputMode: output.mode,
  fallbackReason: output.fallbackReason,
  revisionCount
});
```

- `auto_approve`: gọi `approveRun` bằng actor `policy-engine`, gửi thông báo `AUTO-HANDOFF`, rồi chạy nextRun.
- `auto_revise`: reject/revise bằng policy actor, gửi lý do, chạy revision.
- `escalate`: giữ pending approval và gửi package đầy đủ cho Admin.
- `human_approval`: Final giữ pending approval và gửi package đầy đủ cho Admin.

- [ ] **Step 4: Cập nhật tin nhắn mở campaign**

Nêu rõ chế độ tự bàn giao và hai cổng của Admin; không còn mô tả duyệt sau từng stage.

- [ ] **Step 5: Chạy test**

Run: `npm test -- tests/enterpriseSequence.test.ts tests/goldenSequence.test.ts`
Expected: PASS.

### Task 5: Dashboard, tài liệu và health report

**Files:**
- Modify: `src/integrations/controlApi.ts`
- Modify: `README.md`
- Modify: `docs/operations/SIX_AGENT_SEQUENCE_DEMO.md`
- Modify: `docs/operations/PRODUCTION_READINESS_AUDIT.md`
- Test: `tests/controlApi.test.ts`

**Interfaces:**
- Dashboard service detail hiển thị approval mode.
- Tài liệu demo chỉ yêu cầu Final approval và publication confirmation.

- [ ] **Step 1: Cập nhật test read model**

Assert service `Human approval` mô tả `Final + publication` trong enterprise mode.

- [ ] **Step 2: Cập nhật read model và tài liệu**

Không thay đổi quyền phê duyệt của dashboard; dashboard tiếp tục chỉ quan sát.

- [ ] **Step 3: Chạy test**

Run: `npm test -- tests/controlApi.test.ts`
Expected: PASS.

### Task 6: Verification, runtime và GitHub

**Files:**
- Verify all modified files.

- [ ] **Step 1: Chạy quality gate**

Run lần lượt:

```powershell
npm test
npm run typecheck
npm run build
npm run smoke
npm run audit:system
npm audit --audit-level=high
git diff --check
```

Expected: tất cả exit 0; 6/6 Telegram; Meta connected; không có page error.

- [ ] **Step 2: Khởi động lại Telegram runtime**

Stop đúng process `scripts/telegram-bot.ts`, sau đó chạy `npm run telegram:bot`. Expected: sáu Agent active.

- [ ] **Step 3: Commit và push**

```powershell
git add .env.example README.md docs scripts src tests
git commit -m "feat: automate internal agent handoffs by risk"
git push origin codex/six-agent-meta-office
```

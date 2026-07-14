# OWNER-A Telegram Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thiện phần OWNER-A thành Telegram-first marketing agent runtime có phân quyền chặt, phối hợp tuần tự giữa ba phòng ban, AI fallback an toàn và bằng chứng vận hành rõ ràng.

**Architecture:** Các hàm runtime thuần được tách khỏi vòng polling Telegram để kiểm thử authorization, làm sạch nội dung, context handoff và health report. AI provider chịu trách nhiệm timeout/retry/fallback; bot script chịu trách nhiệm long polling bền vững và điều phối output Market Radar sang Content Creator rồi Performance Brand.

**Tech Stack:** TypeScript, Telegram Bot API, OpenAI-compatible API/9Router, Vitest, Node.js fetch.

## Global Constraints

- Chỉ Telegram-first; không thêm Lark vào command hoặc prompt mới.
- Không commit `.env`, token hoặc API key.
- Không tự publish, chạy ads, deploy hoặc merge.
- Chỉ operator và group đã cấu hình được chạy lệnh nghiệp vụ.
- Mọi output chuyên môn phải qua human approval.

---

### Task 1: Runtime security and presentation helpers

**Files:**
- Create: `src/integrations/telegramRuntime.ts`
- Create: `tests/telegramRuntime.test.ts`
- Modify: `scripts/telegram-bot.ts`

- [x] Viết test authorization fail-closed, health report, clean output và handoff context.
- [x] Chạy test để xác nhận thất bại do module chưa tồn tại.
- [x] Cài đặt helper tối thiểu và tích hợp vào bot script.
- [x] Chạy test mới đến khi pass.

### Task 2: Resilient AI provider

**Files:**
- Modify: `src/integrations/aiProvider.ts`
- Modify: `tests/aiProvider.test.ts`

- [x] Viết test fallback khi fetch lỗi/response rỗng và prompt không còn Lark.
- [x] Chạy test để xác nhận hành vi cũ thất bại.
- [x] Thêm timeout, retry có giới hạn và mock fallback có lý do.
- [x] Chạy toàn bộ AI provider tests.

### Task 3: Professional approval and diagnostics flow

**Files:**
- Modify: `src/integrations/telegramAdapter.ts`
- Modify: `tests/marketingTelegramTeam.test.ts`
- Modify: `tests/telegramAdapter.test.ts`
- Modify: `scripts/telegram-setup.ts`

- [x] Viết test `/health`, reject bắt buộc lý do và evidence từ chối.
- [x] Cập nhật command menu và thông báo tiếng Việt.
- [x] Giữ tương thích các command marketing hiện có.
- [x] Chạy adapter tests.

### Task 4: Sequential orchestration and polling resilience

**Files:**
- Modify: `scripts/telegram-bot.ts`
- Modify: `.env.example`
- Modify: `README.md`

- [x] Truyền output Market Radar vào context Content Creator.
- [x] Truyền insight và content vào context Performance Brand.
- [x] Bắt lỗi polling, retry có backoff và không làm dừng toàn bộ service.
- [x] Thêm biến timeout/retry mẫu và hướng dẫn `/health`.

### Task 5: Verification and delivery

**Files:**
- Verify: toàn bộ thay đổi OWNER-A.

- [x] Chạy `npm run test`.
- [x] Chạy `npm run typecheck`.
- [x] Chạy `npm run build`.
- [x] Quét secret và kiểm tra staged diff.
- [x] Commit Conventional Commit và push feature branch.

# CLAUDE.md

Hướng dẫn cho AI (Claude Code) khi làm việc trong repo này. Đọc file này trước khi sửa code.

## Dự án là gì

**AI Marketing Command Center** — phòng marketing vận hành bởi **6 AI Agent**, điều khiển qua **Telegram**, xuất bản lên **Facebook (Meta)**. Mục tiêu: một người vận hành cả phòng marketing ("doanh nghiệp 1 người") theo mô hình **human-in-the-loop**.

Chu trình: `Nhận yêu cầu → Nghiên cứu thị trường & đối thủ → Lập chiến dịch → Tạo nội dung + video → Kiểm định → Người duyệt → Đăng Facebook → CSKH → Đo lường → Tự cải tiến`.

Phạm vi: **Telegram-first + Facebook-first**. KHÔNG dùng Lark trong luồng triển khai (`larkAdapter.ts` là di sản, đừng mở rộng).

## Lệnh hay dùng

```bash
npm run test        # vitest — CHẠY TRƯỚC KHI BÁO XONG
npm run typecheck   # tsc -b
npm run build       # tsc -b && vite build
npm run check       # test + typecheck + build (chạy đủ trước khi merge)
npm run dev         # Vite dashboard @127.0.0.1:5173
npm run control:api # Control API + SSE @127.0.0.1:8787 (nguồn dữ liệu cho dashboard)
npm run telegram:bot / telegram:setup   # runtime Telegram (cần token trong .env)
npm run smoke       # Playwright smoke — CẦN dev server chạy sẵn
```

Chạy 1 file test: `npx vitest run tests/<tên>.test.ts`.

## Stack

Vite · React 18 · TypeScript (strict, `tsc -b`) · **Zod v4** · Vitest · `tsx` cho script · `node:http` cho Control API. Không có backend framework — Control API là HTTP server thuần.

## Kiến trúc & quyền sở hữu file

Hai người phát triển song song, **tôn trọng ranh giới sở hữu** (xem `docs/PHAN_CONG_2_NGUOI_PHAT_TRIEN_PHONG_AI_AGENT_MARKETING.md`):

- **Kiên (backend/AI/Telegram)** — sở hữu: `scripts/*.ts`, `src/integrations/*`, `src/domain/*`. Cung cấp Control API đã redacted.
- **Bảo (frontend/dashboard)** — sở hữu: `src/App.tsx`, `src/styles.css`, `src/features/agent-office/*`, `scripts/smoke-agent-flow.cjs`. **Chỉ đọc dữ liệu qua Control API**, không đọc file runtime, không gọi API bên thứ ba từ trình duyệt.

Khi sửa, chỉ động vào file thuộc phạm vi công việc. Nếu đổi API/schema dùng chung, ghi **biên bản bàn giao** vào `docs/handoffs/`.

### Luồng dữ liệu
```
Telegram (Admin) → managerIntent → marketingWorkflow (stage-gate) → aiProvider (6 agent)
                 → approvalPolicy → metaGraphAdapter (guarded)
telegramStateStore (snapshot, idempotency, recovery)
        ↓
controlApi (read model REDACTED + SSE)  →  dashboard của Bảo (fetch/SSE)
```

## Quy ước code BẮT BUỘC (theo pattern hiện có)

1. **Zod cho mọi input ngoài**: dùng `z.strictObject`. Xem `agentWorkProduct.ts`, `competitorTypes.ts` làm mẫu. **Zod v4**: partial record dùng `z.partialRecord(key, val)` — KHÔNG dùng `z.record` (v4 bắt buộc đủ key).
2. **Hàm thuần, state bất biến**: logic nhận input → trả object mới, không mutate. Truyền `now: () => string` để test xác định thời gian (mặc định `() => new Date().toISOString()`).
3. **Read model redacted**: dữ liệu cho dashboard KHÔNG chứa `dedupKey`, `checksum`, `confidence`, token, PII. Mỗi module có `build*ReadModel(...)` + test khẳng định JSON không lộ (`expect(JSON.stringify(...)).not.toContain("TOKEN")`).
4. **Guarded adapter**: provider ngoài (Meta, video) mặc định KHÓA, tự fallback mock có contract tương đương khi chưa có key hoặc lỗi — KHÔNG ném lỗi ra ngoài. Xem `aiProvider.ts`, `videoGenerationAdapter.ts`.
5. **Idempotency & chống trùng**: dùng `dedupKey`/`checksum` ổn định (hash xác định), không tạo run/asset/cảnh báo trùng.
6. **Thời gian**: ISO 8601 chuỗi. **ID**: ổn định, duy nhất.
7. **Endpoint mới**: thêm route `GET /api/<x>` vào `controlApi.ts`, trả `build*ReadModel(...)`.

## Nguyên tắc nghiệp vụ KHÔNG được vi phạm

- **Human-in-the-loop**: agent KHÔNG tự đăng, chạy ads, chi tiền, gửi hàng loạt.
- **Final Approval ≠ Publication Confirmation** — hai hành động tách biệt. Chỉ `publication_content` đã duyệt + xác nhận cuối mới gửi tới Meta.
- Agent tự bàn giao nội bộ (Research→Content→Creative→Brand); Admin chỉ duyệt Final Package + xác nhận đăng.
- Bàn giao nội bộ KHÔNG phải hành động xuất bản ra ngoài.
- Không tự retry publish khi chưa đối soát Page (tránh bài trùng).

## Bảo mật

- Token (Telegram/AI/Meta/video) **chỉ** trong `.env` local — không commit, không đưa vào code/log/test/fixture/docs.
- Log & read model phải che token, PII, nội dung nhạy cảm (xem `redactPii` trong `communityInbox.ts`).
- Token lỡ lộ trong ảnh/chat phải thu hồi & tạo lại.

## Quy trình đóng góp

1. Branch theo Issue: `feature/kien-<issue>-<tên>` hoặc `feature/bao-<issue>-<tên>`.
2. TDD: viết test thất bại trước cho logic mới.
3. Chỉ sửa trong phạm vi file sở hữu.
4. Chạy `npm run check` trước khi báo xong.
5. **Conventional Commits**, tách concern (không gom Telegram + video + dashboard + docs vào 1 commit):
   `feat(radar): ...`, `feat(video): ...`, `fix(meta): ...`, `test(workflow): ...`, `docs(thesis): ...`.
6. Không tự merge/deploy/đăng Facebook/chi tiền.

## Bản đồ file backend (src/integrations)

| File | Vai trò |
|------|---------|
| `telegramAdapter.ts` / `telegramRuntime.ts` / `telegramStateStore.ts` | Telegram I/O, runtime, snapshot + phục hồi |
| `managerIntent.ts` | Hiểu ý định tiếng Việt (tạo/duyệt/từ chối/sửa) |
| `marketingWorkflow.ts` | State machine stage-gate của chiến dịch |
| `approvalPolicy.ts` / `workflowApproval.ts` | Policy tự duyệt nội bộ + Final Gate |
| `aiProvider.ts` / `agentWorkProduct.ts` | Gọi AI (9Router, OpenAI-compatible) + schema output |
| `metaGraphAdapter.ts` | Đăng Facebook (guarded) |
| `competitorMonitor.ts` · `marketResearch.ts` · `videoGenerationAdapter.ts` · `campaignAnalytics.ts` · `communityInbox.ts` | 5 module năng lực F02/F03/F06/F10/F11 |
| `campaignOrchestrator.ts` | Điều phối vòng đời chiến dịch (start/approve/reject/publish) không cần Telegram — dùng chung policy engine với bot |
| `controlApi.ts` | HTTP + SSE read model (GET) + write-path (POST: `/api/campaigns`, `/api/approvals/active/approve`, `/api/approvals/active/reject`, `/api/publication/confirm`) |

Write-path: dashboard (App.tsx) → POST Control API → `campaignOrchestrator` → `marketingWorkflow` + `aiProvider` + policy → persist + SSE broadcast. Nút bấm cần `npm run control:api` chạy.

Domain types tương ứng ở `src/domain/*Types.ts`.

## Tài liệu tham chiếu

- Phân công & quy trình: `docs/PHAN_CONG_2_NGUOI_PHAT_TRIEN_PHONG_AI_AGENT_MARKETING.md`
- Thiết kế hệ thống: `docs/superpowers/specs/*`
- Bàn giao contract: `docs/handoffs/*`

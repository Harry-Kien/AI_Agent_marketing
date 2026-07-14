# Bàn giao OWNER-A: Telegram và AI Agent runtime

## Thông tin

- Ngày: 2026-07-14
- Người bàn giao: OWNER-A
- Người nhận: OWNER-B
- Branch: `codex/owner-a-telegram-runtime`
- Commit tính năng: `66641b1`
- Base: `main`

## Phạm vi đã hoàn thành

- Bốn bot Telegram có profile và command menu riêng.
- Manager nhận command và yêu cầu tự nhiên khi Privacy Mode đã tắt.
- `/campaign` chạy tuần tự Market Radar -> Content Creator -> Performance Brand.
- Content Creator nhận output Radar; Performance Brand nhận cả Radar và Content.
- Chỉ group/operator đã cấu hình được chạy lệnh nghiệp vụ.
- `/health` báo số bot, AI provider, model và trạng thái khóa quyền mà không lộ secret.
- `/reject RUN_ID <lý do>` bắt buộc lý do và lưu evidence vào task.
- AI provider có timeout, retry giới hạn và fallback mô phỏng có nhãn rõ.
- Telegram polling có exponential backoff, không dừng service khi lỗi mạng tạm thời.
- Log không ghi token hoặc toàn bộ nội dung yêu cầu.

## Hợp đồng thay đổi

`AiProviderConfig` có thêm hai field tùy chọn:

```ts
timeoutMs?: number;
maxRetries?: number;
```

`MarketingAgentOutput` có thêm:

```ts
fallbackReason?: string;
```

Command reject chuẩn:

```text
/reject <RUN_ID> <lý do cần sửa>
```

OWNER-B có thể đọc `TaskRecord.evidence` để hiển thị lý do từ chối. Runtime Telegram vẫn đang giữ session trong RAM; chưa có API/database chung để dashboard nhận cập nhật realtime.

## Bằng chứng kiểm thử

| Kiểm tra | Kết quả |
|---|---|
| `npm run test` | PASS, 5 files và 40 tests |
| `npm run typecheck` | PASS |
| `npm run build` | PASS, 1.580 modules transformed |
| `npm run smoke` với dashboard port 5174 | PASS, 8 steps, 0 page errors |
| `npm run telegram:setup` | PASS cho 4/4 bot |
| Telegram bot service startup | PASS, 4/4 pollers chạy |
| 9Router `/v1/models` | HTTP 200 |
| Live model request | `mode=ai`, model `cx/gpt-5.4-mini`, không fallback |
| Secret scan staged files | Không phát hiện token/API key |

## OWNER-B cần làm tiếp

1. Chuẩn hóa `src/domain/types.ts` cho Campaign, AgentRun, ApprovalDecision và AuditEvent bằng Issue `shared-contract`.
2. Tạo persistence/API dùng chung; không đọc trực tiếp RAM state của bot process.
3. Hiển thị `pending_approval`, `approved`, `rejected` và rejection evidence trên Approval Queue.
4. Xóa hoặc chuyển các màn hình Lark placeholder cũ khỏi quy trình Telegram-first.
5. Viết contract test để Telegram và Dashboard dùng cùng `RUN_ID`, `TASK_ID`, `CAMPAIGN_ID`.

## Giới hạn và lưu ý demo

- BotFather Privacy Mode của Marketing Manager phải được tắt thủ công để nhận tin nhắn tự nhiên trong group.
- Không chạy hai process `telegram:bot` cùng lúc với cùng token; Telegram sẽ trả lỗi conflict cho long polling.
- Khi process restart, pending approvals trong RAM sẽ mất.
- Fallback mô phỏng giúp demo không treo nhưng phải được trình bày rõ là mock.
- Không có hành động publish, ads, deploy hoặc merge tự động.

# Bàn giao OWNER-A: Enterprise Stage-Gate Telegram Runtime

## Trạng thái

- Nhánh: `codex/owner-a-telegram-runtime`
- Phạm vi: Telegram, AI provider, workflow state machine, persistence và audit.
- Số bot: 4 bot. Đây là cấu hình đủ cho MVP khóa luận; chưa cần thêm bot Telegram.

## Năng lực đã hoàn thành

| Thành phần | Trạng thái | Ghi chú |
|---|---|---|
| Marketing Manager | Hoàn thành | Nhận brief, tạo campaign, quản lý cổng duyệt, final package |
| Market Radar | Hoàn thành | Research Package là cổng đầu tiên |
| Content Creator | Hoàn thành | Chỉ nhận research đã duyệt |
| Performance Brand | Hoàn thành | Review brand, claim, CTA và KPI |
| Stage-Gate | Hoàn thành | Research → Content → Brand → Final, bốn lần human approval |
| Rework | Hoàn thành | Reject có lý do; revise tạo run mới, giữ parent run |
| Persistence | Hoàn thành | Atomic JSON snapshot, quarantine file lỗi, restart recovery |
| Audit | Hoàn thành | Campaign/run actor, action, summary và timestamp |
| Idempotency | Hoàn thành | Approve lặp không sinh run mới; update ID và offset được lưu |
| External execution | Cố ý không làm | Không publish, không chạy ads, không chi tiền |

## Contract cho OWNER-B

Nguồn dữ liệu runtime hiện nằm ở `output/telegram-runtime-state.json` và bị Git ignore. Dashboard không nên đọc file này trực tiếp ở production. OWNER-B dùng các type trong:

- `MarketingCampaignRuntime`
- `MarketingAgentRunRuntime`
- `TelegramAuditEvent`
- `MarketingWorkflowState`

Các trạng thái campaign:

```text
research_running -> research_pending_approval
content_running -> content_pending_approval
brand_running -> brand_pending_approval
finalizing -> final_pending_approval
rework_required
ready_to_execute
failed
```

Dashboard nên có ba view tối thiểu:

1. Campaign Board: campaign ID, brief, stage, approved gates, active run.
2. Approval Queue: run ID, stage, role, output, approve/reject/revise.
3. Audit Timeline: actor, action, timestamp, summary.

## Kịch bản kiểm thử tích hợp

```text
/health
/campaign Ra mắt dịch vụ AI Agent cho SME trên Facebook, mục tiêu đặt lịch tư vấn
/approvals
/approve RESEARCH_RUN_ID
/approve CONTENT_RUN_ID
/reject BRAND_RUN_ID KPI chưa có công thức đo và mốc thời gian
/revise BRAND_RUN_ID Bổ sung KPI, công thức đo, baseline và target 30 ngày
/approve BRAND_REVISION_RUN_ID
/approve FINAL_RUN_ID
/status CAMPAIGN_ID
/audit CAMPAIGN_ID
```

Acceptance cuối: campaign phải là `ready_to_execute`; không có connector publish nào được gọi.

## Việc OWNER-B làm tiếp

1. Chuyển Dashboard sang model Campaign/Run/Audit ở trên.
2. Tạo API hoặc repository chung thay cho việc UI đọc trực tiếp snapshot.
3. Thêm Approval Queue và Campaign Timeline.
4. Viết contract test dùng cùng ID và enum với OWNER-A.
5. Giữ ranh giới: dashboard không được tự publish hoặc bỏ qua approval gate.

## Lưu ý vận hành

- Chỉ chạy một process `telegram:bot` cho cùng bộ token.
- Bot Manager cần tắt Privacy Mode để nhận tin nhắn tự nhiên trong group.
- `.env` và snapshot runtime không được commit.
- 9Router lỗi sẽ dùng output fallback có nhãn; output vẫn phải chờ duyệt.

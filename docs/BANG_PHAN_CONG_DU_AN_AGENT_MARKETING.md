# Bảng mô tả và phân công dự án AI Agent Marketing Command Center

> **BẢN LƯU TRỮ TRƯỚC NÂNG CẤP 6 AGENT.** Nguồn sự thật hiện hành: `README.md`, `docs/operations/SIX_AGENT_SEQUENCE_DEMO.md` và `docs/operations/PRODUCTION_READINESS_AUDIT.md`.

## 1. Đánh giá dashboard hiện tại

Dashboard hiện tại đã có nền tảng MVP:

| Khu vực | Đã có chưa | Mức độ hiện tại | Cần nâng cấp để chuyên nghiệp hơn |
|---|---:|---|---|
| Dashboard tổng quan | Có | Có số repo, task mở, review, repo lỗi, release ready | Cần đổi sang chỉ số marketing: campaign active, content pending, approval queue, KPI |
| Repo Registry | Có | Quản lý repo demo | Nếu dự án tập trung marketing, đổi thành Campaign/Asset Registry hoặc giữ như phần kỹ thuật |
| Task Pipeline | Có | Kanban theo trạng thái task | Cần thêm lọc theo campaign, agent, priority, deadline |
| Agent Board | Có | Hiển thị 8 agent repo/software | Cần thêm board 4 agent marketing chuyên sâu |
| Agent Runs | Có | Xem output agent mô phỏng | Cần có lịch sử output Telegram/AI, approval status, reviewer |
| Daily Brief | Có | Brief rule-based | Cần brief marketing theo ngày: campaign nóng, nội dung chờ duyệt, KPI, rủi ro |
| Telegram Setup | Có | Hướng dẫn command | Cần hiển thị trạng thái bot, role, command, group/operator lock |
| Lark Export | Có | Export JSON/CSV | Cần schema riêng cho Campaigns, Content Drafts, Approvals, Agent Runs |
| Approval Queue | Chưa rõ | Đang nằm trong Telegram runtime | Cần dashboard riêng cho duyệt/từ chối |
| Content Calendar | Chưa có | Chưa có lịch đăng | Cần có lịch nội dung theo ngày/kênh |
| KPI/Analytics | Chưa có | Chỉ có metric kỹ thuật | Cần có CTR, lead, conversion, response, content velocity |
| Audit Log | Chưa có | Chưa có log hành động | Cần log ai yêu cầu, bot nào xử lý, ai approve, lúc nào |

Kết luận:

Dashboard hiện tại **đã đủ làm MVP kỹ thuật**, nhưng để thành **hệ thống marketing agent chuyên nghiệp**, cần nâng cấp thành dashboard quản trị chiến dịch, nội dung, approval, KPI và audit log.

## 2. Cấu trúc dashboard quản lý chuyên nghiệp cần có

### 2.1. Màn hình 1: Marketing Command Dashboard

Mục tiêu: cho người quản lý nhìn ngay tình hình marketing trong ngày.

| Thành phần | Mô tả | Dữ liệu cần có | Người phụ trách |
|---|---|---|---|
| Active Campaigns | Số chiến dịch đang chạy | campaign.status = active | Người 2 |
| Pending Approvals | Output đang chờ duyệt | approval.status = pending | Người 1 + Người 2 |
| Content Drafts | Số bản nháp nội dung | content.status = draft | Người 2 |
| Agent Workload | Bot nào đang có nhiều việc | agent.current_tasks | Người 2 |
| Today Brief | Việc cần làm hôm nay | dailyBrief.suggested_actions | Người 2 |
| Risk Alerts | Rủi ro claim, KPI, thiếu duyệt | risk.type, severity | Người 1 + Người 2 |

### 2.2. Màn hình 2: Campaign Board

Mục tiêu: quản lý toàn bộ chiến dịch marketing.

| Trường | Mô tả |
|---|---|
| campaign_id | Mã chiến dịch |
| name | Tên chiến dịch |
| objective | Mục tiêu |
| target_audience | Khách hàng mục tiêu |
| offer | Ưu đãi/thông điệp chính |
| channel | Kênh triển khai |
| status | idea, researching, drafting, reviewing, approved, published, measured |
| owner | Người/bot phụ trách |
| priority | Mức ưu tiên |
| created_at | Ngày tạo |
| updated_at | Ngày cập nhật |

Pipeline đề xuất:

```text
idea -> researching -> drafting -> reviewing -> approved -> scheduled -> published -> measured
```

### 2.3. Màn hình 3: Agent Department Board

Mục tiêu: thể hiện rõ đội bot như phòng ban trong doanh nghiệp.

| Bot | Vai trò | Đầu vào | Đầu ra | KPI chất lượng | Trạng thái |
|---|---|---|---|---|---|
| Marketing Manager Bot | Điều phối | Mục tiêu, yêu cầu, brief | Campaign plan, task assignment, approval request | Đúng người, đúng việc, có bước tiếp theo | working/idle |
| Market Radar Bot | Nghiên cứu thị trường | Chủ đề, ngành, khách hàng | Insight, audience, competitor, angle | Insight cụ thể, không bịa số liệu | working/idle |
| Content Creator Bot | Sản xuất nội dung | Brief, insight, offer | Hook, post, caption, script, CTA | Đúng giọng, rõ CTA, dễ hiểu | working/idle |
| Performance Brand Bot | Kiểm duyệt | Bản nháp, mục tiêu, kênh | Review, risk, KPI, go/no-go | Không overclaim, có KPI, có khuyến nghị | working/idle |

### 2.4. Màn hình 4: Approval Queue

Mục tiêu: con người duyệt output một cách có kiểm soát.

| Trường | Mô tả |
|---|---|
| run_id | Mã output |
| campaign_id | Chiến dịch liên quan |
| agent_id | Bot tạo output |
| output_type | insight/content/review/report |
| summary | Tóm tắt output |
| risk_level | low/medium/high |
| status | pending/approved/rejected |
| requested_at | Thời điểm tạo |
| approved_by | Người duyệt |
| approved_at | Thời điểm duyệt |
| note | Ghi chú |

Chức năng:

- Xem output đang chờ.
- Approve.
- Reject.
- Ghi lý do reject.
- Lưu audit log.

### 2.5. Màn hình 5: Content Calendar

Mục tiêu: biến output AI thành kế hoạch nội dung.

| Trường | Mô tả |
|---|---|
| content_id | Mã nội dung |
| campaign_id | Chiến dịch |
| channel | Facebook, TikTok, LinkedIn, Email |
| content_type | post, caption, video_script, email |
| title | Tiêu đề |
| draft | Nội dung nháp |
| status | draft, review, approved, scheduled, published |
| planned_date | Ngày dự kiến |
| owner_agent | Agent tạo |
| approval_id | Mã phê duyệt |

### 2.6. Màn hình 6: KPI & Analytics

Mục tiêu: đo hiệu quả marketing.

| Chỉ số | Ý nghĩa |
|---|---|
| Content Velocity | Số nội dung tạo mỗi tuần |
| Approval Time | Thời gian từ draft đến approve |
| Rejection Rate | Tỷ lệ output bị reject |
| Campaign Cycle Time | Thời gian từ idea đến published |
| Lead Count | Số lead tạo được |
| CTR | Tỷ lệ click |
| Conversion Rate | Tỷ lệ chuyển đổi |
| Best Channel | Kênh hiệu quả nhất |

Giai đoạn MVP có thể dùng dữ liệu mẫu.

### 2.7. Màn hình 7: Audit Log

Mục tiêu: đáp ứng yêu cầu kiểm soát trong doanh nghiệp.

| Trường | Mô tả |
|---|---|
| log_id | Mã log |
| actor_type | human/agent/system |
| actor_name | Người hoặc bot thực hiện |
| action | create_campaign, run_agent, approve, reject |
| target_id | ID task/campaign/output |
| timestamp | Thời điểm |
| detail | Chi tiết |

## 3. Bộ bot chuẩn cho hệ thống marketing chuyên nghiệp

### 3.1. Bản MVP hiện tại: 4 bot

| Bot | Có nên giữ? | Lý do |
|---|---:|---|
| Marketing Manager Bot | Có | Trung tâm điều phối |
| Market Radar Bot | Có | Nghiên cứu thị trường |
| Content Creator Bot | Có | Tạo nội dung |
| Performance Brand Bot | Có | Kiểm duyệt và KPI |

### 3.2. Bản mở rộng sau MVP: 8 bot marketing

Nếu muốn hệ thống nhìn “xịn” hơn trong khóa luận, có thể mô tả roadmap 8 bot:

| Bot | Vai trò | Mức ưu tiên |
|---|---|---|
| Marketing Manager Bot | Điều phối toàn bộ | MVP |
| Market Radar Bot | Nghiên cứu thị trường | MVP |
| Customer Insight Bot | Chân dung khách hàng, pain point | Post-MVP |
| Content Creator Bot | Tạo nội dung | MVP |
| Channel Planner Bot | Lập lịch/kênh triển khai | Post-MVP |
| Performance Brand Bot | Review, KPI, brand safety | MVP |
| Analytics Bot | Đo hiệu quả sau chiến dịch | Post-MVP |
| Knowledge Base Bot | Nhớ tài liệu thương hiệu, sản phẩm | Post-MVP |

Khuyến nghị cho 2 người: **không nên code 8 bot ngay**. Hãy code 4 bot thật tốt, tài liệu mô tả roadmap 8 bot. Như vậy demo gọn, dễ kiểm soát, vẫn đủ chuyên nghiệp.

## 4. Bảng phân công công việc cho 2 người

### 4.1. Phân công theo vai trò

| Nhóm việc | Người 1: Backend/Agent/Telegram | Người 2: Frontend/Dashboard/Data | Kết quả cần nộp |
|---|---|---|---|
| Phân tích yêu cầu | Góp ý luồng bot, approval | Góp ý dashboard, data model | Tài liệu requirement |
| Telegram bot | Chính | Review | 4 bot chạy trong group |
| Agent orchestration | Chính | Review UI trạng thái | Manager tự giao việc và auto-run |
| AI Provider | Chính | Review output format | Gọi 9Router ổn định |
| Prompt engineering | Chính | Góp ý giọng marketing | Prompt đúng vai trò |
| Dashboard tổng quan | Review | Chính | Màn hình quản lý marketing |
| Campaign Board | Review data API | Chính | Quản lý chiến dịch |
| Approval Queue | Logic approve/reject | UI approval queue | Duyệt output rõ ràng |
| Content Calendar | Cung cấp data output | Chính | Lịch nội dung |
| KPI Analytics | Cung cấp event/log | Chính | Bảng chỉ số |
| Data model | Review field integration | Chính | Type/schema rõ |
| Lark Export | Adapter/API boundary | UI/export | JSON/CSV export |
| Test | Test adapter/provider | Test domain/UI | Test pass |
| Tài liệu | Sequence Telegram/AI | ERD, DFD, dashboard docs | Báo cáo khóa luận |
| Demo | Bot demo | Dashboard demo | Kịch bản bảo vệ |

### 4.2. Phân công theo file

| File/thư mục | Người phụ trách chính | Người review | Ghi chú |
|---|---|---|---|
| `scripts/telegram-bot.ts` | Người 1 | Người 2 | Long polling, routing, auto-run |
| `scripts/telegram-setup.ts` | Người 1 | Người 2 | Set command/menu bot |
| `src/integrations/telegramAdapter.ts` | Người 1 | Người 2 | Bot profile, command handling |
| `src/integrations/aiProvider.ts` | Người 1 | Người 2 | Prompt, 9Router, fallback |
| `src/App.tsx` | Người 2 | Người 1 | Dashboard UI |
| `src/styles.css` | Người 2 | Người 1 | Giao diện |
| `src/domain/types.ts` | Người 2 | Người 1 | Data model |
| `src/domain/operations.ts` | Người 2 | Người 1 | Business logic |
| `src/data/seed.ts` | Người 2 | Người 1 | Dữ liệu mẫu |
| `src/integrations/larkAdapter.ts` | Người 2 | Người 1 | Export Lark-ready |
| `tests/*` | Cả hai | Cả hai | Ai làm module nào viết test module đó |
| `docs/*` | Người 2 | Người 1 | Tài liệu khóa luận |
| `README.md` | Người 2 | Người 1 | Hướng dẫn chạy |

## 5. Roadmap code để hoàn thành dự án

### Sprint 1: Chuẩn hóa Telegram Agent

| Task | Người phụ trách | Branch | Tiêu chí hoàn thành |
|---|---|---|---|
| Làm sạch output Telegram | Người 1 | `feature/clean-telegram-output` | Không còn raw Markdown |
| Thêm typing indicator | Người 1 | `feature/telegram-typing` | Bot có trạng thái soạn tin |
| Siết prompt theo vai trò | Người 1 | `feature/agent-role-prompts` | Bot trả đúng nhiệm vụ |
| Thêm approval/reject ổn định | Người 1 | `feature/approval-flow` | Approve cập nhật trạng thái |
| Viết test routing bot | Người 1 | `test/telegram-routing` | Test pass |

### Sprint 2: Nâng cấp Dashboard Marketing

| Task | Người phụ trách | Branch | Tiêu chí hoàn thành |
|---|---|---|---|
| Thêm Marketing Dashboard | Người 2 | `feature/marketing-dashboard` | Có campaign, approval, KPI cards |
| Thêm Campaign Board | Người 2 | `feature/campaign-board` | Có pipeline chiến dịch |
| Thêm Approval Queue UI | Người 2 | `feature/approval-queue-ui` | Xem output chờ duyệt |
| Thêm Content Calendar | Người 2 | `feature/content-calendar` | Có lịch nội dung mẫu |
| Thêm Audit Log | Người 2 | `feature/audit-log` | Có lịch sử hành động |

### Sprint 3: Data model và export

| Task | Người phụ trách | Branch | Tiêu chí hoàn thành |
|---|---|---|---|
| Thêm type Campaign | Người 2 | `feature/campaign-data-model` | Có CampaignRecord |
| Thêm type ContentDraft | Người 2 | `feature/content-data-model` | Có ContentDraftRecord |
| Thêm type Approval | Người 1 + 2 | `feature/approval-data-model` | Bot và dashboard dùng chung |
| Cập nhật Lark Export | Người 2 | `feature/lark-marketing-export` | Export Campaigns/Approvals |
| Seed data marketing | Người 2 | `feature/marketing-seed-data` | Có dữ liệu demo chuyên nghiệp |

### Sprint 4: Tài liệu và bảo vệ

| Task | Người phụ trách | Branch | Tiêu chí hoàn thành |
|---|---|---|---|
| Sequence diagram | Người 1 | `docs/sequence-diagrams` | Có luồng Telegram/AI/Approval |
| ERD/Data Flow | Người 2 | `docs/data-flow-erd` | Có ERD, DFD |
| README demo | Người 2 | `docs/demo-readme` | Người khác chạy được |
| Slide bảo vệ | Cả hai | `docs/presentation` | Có kịch bản demo |
| Video backup | Cả hai | `docs/demo-video` | Có video phòng lỗi mạng |

## 6. GitHub workflow chuẩn

### 6.1. Nhánh chính

```text
main
dev
feature/*
test/*
docs/*
```

Quy tắc:

- `main`: chỉ chứa bản ổn định để nộp.
- `dev`: nhánh tích hợp.
- `feature/*`: nhánh tính năng.
- `test/*`: nhánh bổ sung test.
- `docs/*`: nhánh tài liệu.

### 6.2. Quy trình làm việc mỗi task

| Bước | Việc cần làm | Ai làm |
|---|---|---|
| 1 | Tạo issue trên GitHub | Người nhận task |
| 2 | Tạo branch từ `dev` | Người nhận task |
| 3 | Code theo đúng phạm vi | Người nhận task |
| 4 | Chạy test/typecheck/build | Người nhận task |
| 5 | Commit rõ nghĩa | Người nhận task |
| 6 | Push branch | Người nhận task |
| 7 | Tạo Pull Request vào `dev` | Người nhận task |
| 8 | Review code | Người còn lại |
| 9 | Sửa feedback | Người nhận task |
| 10 | Merge vào `dev` | Sau khi pass |
| 11 | Cuối sprint merge `dev` vào `main` | Cả hai |

### 6.3. Lệnh kiểm tra bắt buộc

```bash
npm run test
npm run typecheck
npm run build
```

### 6.4. Chuẩn commit

| Loại commit | Ví dụ |
|---|---|
| feat | `feat: add campaign board` |
| fix | `fix: clean telegram output formatting` |
| test | `test: add approval queue tests` |
| docs | `docs: add marketing workflow sequence diagram` |
| refactor | `refactor: split agent role prompts` |
| chore | `chore: update env example` |

## 7. Bảng tiêu chí “xịn và uy tín” cho hệ thống

| Tiêu chí | Mô tả | Trạng thái cần đạt |
|---|---|---|
| Đúng vai trò bot | Mỗi bot chỉ làm đúng chuyên môn | Bắt buộc |
| Output sạch | Không raw Markdown, không quá dài | Bắt buộc |
| Có phê duyệt | Không dùng output nếu chưa approve | Bắt buộc |
| Có dashboard | Người quản lý nhìn được toàn cảnh | Bắt buộc |
| Có audit log | Biết ai/bot nào làm gì | Nên có |
| Có KPI | Đo hiệu quả marketing | Nên có |
| Có data model | Dễ giải thích với giáo viên | Bắt buộc |
| Có sequence diagram | Mô tả luồng xử lý rõ | Bắt buộc |
| Có test | Chứng minh hệ thống ổn định | Bắt buộc |
| Có roadmap mở rộng | Lark/GitHub/GitLab/database | Bắt buộc |

## 8. Kết luận dành cho nhóm 2 người

Để dự án đủ chuẩn khóa luận và demo thuyết phục, hai bạn nên đi theo hướng:

1. Giữ Telegram là nơi trình diễn agent teamwork.
2. Nâng dashboard thành nơi quản trị marketing operation.
3. Không mở rộng quá nhiều bot trong MVP; tập trung làm 4 bot thật tốt.
4. Tài liệu hóa rõ sequence diagram, data flow, ERD và human approval.
5. Làm việc trên GitHub bằng issue, branch, PR, review và test bắt buộc.

Nếu hoàn thành đúng bảng này, dự án sẽ không chỉ là demo bot Telegram mà sẽ trở thành một hệ thống quản trị quy trình marketing bằng AI Agent có cấu trúc, có kiểm soát và có khả năng mở rộng.

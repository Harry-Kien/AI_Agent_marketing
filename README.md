# RepoOps AI Command Center

MVP local cho dự án **Lark Repo Agent Command Center**: một người quản lý nhiều repo GitHub/GitLab và một đội AI Agent như các phòng ban số. Lark là command center để điều phối workflow; GitHub/GitLab là nơi chứa code; AI Agent xử lý task theo vai trò; con người giữ quyền phê duyệt trước các bước quan trọng.

## Tech Stack

- Vite + React + TypeScript
- Local seed data trong `src/data/seed.ts`
- State demo lưu bằng `localStorage`
- Domain workflow trong `src/domain/operations.ts`
- Lark export boundary trong `src/integrations/larkAdapter.ts`
- Vitest cho kiểm thử domain

## Cài Đặt

```bash
npm install
```

MVP không cần `.env` để chạy. File `.env.example` chỉ ghi các key tương lai cho Lark, GitHub/GitLab và OpenAI.

## Chạy Local

```bash
npm run dev
```

Mở URL local mà terminal in ra. Nếu port `5173` bận, dùng port khác như `5174`.

```text
http://127.0.0.1:5174/
```

## Scripts

```bash
npm run test
npm run typecheck
npm run build
npm run smoke
npm run telegram:setup
npm run telegram:bot
npm run check
```

Hiện repo chưa có ESLint riêng. `test`, `typecheck`, `build`, `audit` và `smoke` là các gate chất lượng chính của MVP.

## Telegram-First Demo

Giai đoạn này chưa cần Lark. Telegram đóng vai trò command surface nhanh, còn dashboard local vẫn là bảng điều phối và nơi xem dữ liệu.

Kiến trúc demo marketing:

- 1 Marketing Manager Bot nhận lệnh từ bạn và giữ approval gate.
- 1 Market Radar Bot nghiên cứu trend, đối thủ, audience, insight.
- 1 Content Creator Bot tạo post, caption, script, hook, content calendar.
- 1 Performance Brand Bot review brand tone, CTA, KPI và báo cáo.
- Mỗi lệnh agent tạo output và pending approval.
- Không tự động sửa code, merge, deploy, release hoặc publish.
- Task chỉ được chuyển trạng thái khi bạn gửi `/approve RUN_ID`.

Chuẩn bị:

1. Tạo 4 bot bằng `@BotFather`.
2. Tạo group demo, ví dụ `AI Marketing Command Center`.
3. Add 4 bot vào group.
4. Tạo file `.env` từ `.env.example`.
5. Điền 4 biến `TELEGRAM_*_BOT_TOKEN`.
6. Tùy chọn điền `TELEGRAM_GROUP_ID` và `OPERATOR_TELEGRAM_USER_ID` để giới hạn quyền điều khiển.

Chạy bot local:

```bash
npm run telegram:setup
npm run telegram:bot
```

`telegram:setup` tự cài command menu cho từng bot. `telegram:bot` chạy 4 bot local bằng long polling.

Nếu dùng 9Router Proxy local như demo hiện tại, cấu hình trong `.env`:

```env
NINE_ROUTER_ENABLED=true
NINE_ROUTER_BASE_URL=http://localhost:20128/v1
NINE_ROUTER_MODEL=cx/gpt-5.4-mini
# NINE_ROUTER_API_KEY= chỉ cần điền nếu bật Require API key trong 9Router
```

Các bot chuyên môn sẽ gọi cổng OpenAI-compatible này cho output AI thật. Nếu endpoint hoặc model lỗi, bot tự fallback sang simulated output để demo vẫn chạy. Sau khi add bot vào group, gửi `/flow` trong group một lần rồi lấy `TELEGRAM_GROUP_ID` và `OPERATOR_TELEGRAM_USER_ID` từ update Telegram để khóa đúng group và đúng người điều khiển.

Lệnh demo trong Telegram:

```text
/brief
/flow
/campaign ra mat dich vu AI Agent cho doanh nghiep nho
/trend AI Agent cho SME
/post bai Facebook ve AI Agent
/review noi dung truoc khi dang
/tasks
/run mk-task-021
/approve RUN_ID
/reject RUN_ID
/report
```

Bot đang dùng long polling qua Telegram Bot API, nên không cần webhook, domain công khai, SSL, hay Lark credentials trong MVP.

Chức năng từng bot:

- Marketing Manager Bot: `/brief`, `/flow`, `/campaign`, `/tasks`, `/run`, `/approve`, `/reject`, `/report`.
- Market Radar Bot: `/trend`, `/competitor`, `/audience`, `/insight`, `/angle`.
- Content Creator Bot: `/post`, `/caption`, `/script`, `/calendar`, `/hook`.
- Performance Brand Bot: `/review`, `/brandcheck`, `/cta`, `/measure`, `/report`.

Quy trình chuẩn trong group:

1. Bạn gửi `/flow` cho Marketing Manager Bot để xem kịch bản vàng.
2. Bạn gửi `/campaign <mục tiêu chiến dịch>` cho Marketing Manager Bot.
3. Backend tự dùng Market Radar Bot, Content Creator Bot và Performance Brand Bot để phát assignment/handoff vào group.
4. Bạn chạy hoặc bấm lệnh chuyên môn tương ứng: `/trend`, `/post`, `/review`.
5. Bot chuyên môn tạo output có cấu trúc và pending approval.
6. Bạn dùng Marketing Manager Bot để `/approve RUN_ID` hoặc `/reject RUN_ID`.
7. Bạn dùng `/report` để xem campaign task và approval còn chờ.

## MVP Scope

- Dashboard: tổng repo, task mở, task chờ review, repo lỗi build/test, release ready, daily brief, top task.
- Repo Registry: xem, lọc, thêm, sửa repo và mở chi tiết repo.
- Task Pipeline: `idea -> spec -> issue -> coding -> testing -> review -> ready_to_release -> released -> measured`.
- Agent Department Board: 8 agent theo mô hình phòng ban số và nút `Run simulated agent`.
- Agent Workflow Demo: chọn một task và chạy đủ 8 agent theo luồng CEO/PM -> Radar -> Spec -> Coding -> Review -> Docs -> Release -> Analytics.
- Repo Detail: thông tin repo, task liên quan, health snapshot, release checklist, agent notes, timeline.
- Daily Brief: brief mẫu và nút tạo brief rule-based local.
- Telegram: hướng dẫn bot demo, command list, approval rule và cách chạy `npm run telegram:bot`.
- Lark Export: export JSON/CSV cho `Repos`, `Tasks`, `Agents`, `Agent Runs`, `Daily Briefs`.
- Human approval: simulated agent chỉ tạo handoff/output đề xuất; không tự merge, deploy, publish hoặc sửa repo thật.

## Data Model

Task bắt buộc có:

- repo
- priority
- assigned_agent
- input
- expected_output
- quality_gate
- evidence
- status
- created_at
- updated_at

Agent bắt buộc có:

- mission
- input_schema
- output_schema
- current_tasks
- status
- simulated output action

## Seed Data

MVP có sẵn:

- 5 repo mẫu
- 8 agent mẫu
- 20 task mẫu ở nhiều trạng thái
- 5 health check mẫu
- 3 daily brief mẫu

Repo mẫu bao gồm các hướng:

- AI social media automation
- Repo trend radar
- AI content agent
- Lark operations dashboard
- Thesis demo app

## Demo Flow

1. Mở Dashboard và giới thiệu đây là trung tâm điều hành repo cho doanh nghiệp 1 người.
2. Vào Repos để xem danh sách repo.
3. Bấm `Chi tiết` trên một repo để xem Repo Detail.
4. Tạo một task mới trong Tasks.
5. Gán task cho Agent bằng dropdown trong form tạo task.
6. Chuyển trạng thái task trong Task Pipeline.
7. Vào Agents, chọn một task trong `Agent Workflow Demo`, bấm `Run full agent flow`.
8. Trình bày 8 bước bàn giao: CEO/PM -> Radar -> Spec -> Coding -> Review -> Docs -> Release -> Analytics.
9. Bấm `Run simulated agent` trên từng agent nếu muốn xem output riêng.
10. Xem output có cấu trúc và dòng `Human approval required`.
11. Vào Daily Brief để xem/tạo brief rule-based.
12. Vào Telegram để xem command list, chạy bot local, rồi demo `/brief`, `/newtask`, `/run`, `/approve`.
13. Vào Lark Export để xem JSON/CSV có thể đưa sang Lark Base.

## Acceptance Criteria

- App chạy local được.
- Dashboard hiển thị dữ liệu mẫu.
- Có thể thêm/sửa repo.
- Có thể thêm task và chuyển trạng thái.
- Có thể xem Agent và chạy simulated agent output.
- Có thể xem repo detail.
- Có daily brief.
- Có màn hình Telegram và script `telegram:bot` cho demo manager bot.
- Có export JSON/CSV cho Lark Base.
- Có README hướng dẫn cài đặt, chạy app và demo flow.
- Có seed data đầy đủ.
- TypeScript/build/test không có lỗi nghiêm trọng.
- Browser smoke cho luồng 8-agent không có page error.

## Mock Trong MVP

- Dữ liệu repo/task/agent/health/brief là seed local.
- Thay đổi khi demo lưu trong `localStorage`, chưa có database server.
- Agent output là rule-based simulation, chưa gọi OpenAI API.
- Telegram bot là local long-polling demo, chưa có persistence server/database riêng.
- Health check là dữ liệu mẫu, chưa gọi GitHub/GitLab API thật.
- Lark Export tạo JSON/CSV, chưa gọi Lark Base API thật.

## Sẵn Sàng Nối Thật

- `src/integrations/larkAdapter.ts`: thay export-only flow bằng Lark Base OpenAPI khi có tenant credentials, base ID, table ID và approval flow.
- `src/domain/types.ts`: kiểu dữ liệu rõ để map sang bảng Lark Base.
- `src/domain/operations.ts`: workflow task, dashboard stats, repo detail, daily brief và simulated agent tách khỏi UI.
- `.env.example`: vị trí khai báo key tương lai cho Lark, GitHub/GitLab và OpenAI.

## Roadmap Sau MVP

1. Lark Base write API: đồng bộ Repos, Tasks, Agents, Agent Runs và Daily Briefs.
2. GitHub/GitLab sync: lấy repo metadata, issue, branch, PR/MR, build/test status.
3. OpenAI summary: tạo daily brief và agent handoff bằng LLM nhưng vẫn yêu cầu human approval.
4. Approval log: ghi lại ai duyệt, duyệt lúc nào, duyệt hành động gì.
5. Repo automation guardrails: chỉ tạo đề xuất/checklist/PR draft, không tự merge hoặc deploy.
6. Role-based views: PM, Review, Release, Docs và Analytics.

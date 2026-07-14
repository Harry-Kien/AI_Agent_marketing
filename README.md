# AI Agent Marketing Command Center

MVP khóa luận mô phỏng một doanh nghiệp một người điều hành đội AI Marketing qua Telegram. Marketing Manager Bot nhận mục tiêu, điều phối ba bot chuyên môn, yêu cầu con người phê duyệt và giữ lại bằng chứng vận hành. Dashboard web là bảng quản trị local để nhóm tiếp tục hoàn thiện song song.

## Phạm vi hiện tại

- Telegram là command center chính.
- 4 bot hoạt động như 4 vai trò trong phòng Marketing.
- 9Router/OpenAI-compatible API cung cấp model AI; hệ thống tự fallback sang output mô phỏng khi provider lỗi.
- Không tự đăng bài, chạy quảng cáo, chi tiền, deploy hoặc merge code.
- Chỉ group và operator đã cấu hình được chạy lệnh nghiệp vụ.
- Mọi output chuyên môn đều tạo `RUN_ID` và chờ human approval.
- Lark không nằm trong quy trình mục tiêu của MVP Telegram-first.

Lưu ý: mã dashboard được kế thừa từ MVP trước vẫn còn một số màn hình/seed/adapter Lark placeholder. Đây là phần migration của `OWNER-B`; Telegram runtime của `OWNER-A` không phụ thuộc Lark credentials hoặc Lark API.

## Kiến trúc đội Agent

| Bot | Vai trò doanh nghiệp | Trách nhiệm |
|---|---|---|
| Marketing Manager Bot | Marketing Lead | Nhận mục tiêu, tạo campaign, điều phối, báo cáo và approval gate |
| Market Radar Bot | Market Research | Phân tích audience, pain point, trend, đối thủ và angle |
| Content Creator Bot | Content Team | Tạo hook, bài social, caption, script, CTA và lịch nội dung |
| Performance Brand Bot | Brand & Performance | Review tone, claim, CTA, KPI, rủi ro và go/no-go |

Luồng `/campaign` chạy tuần tự:

```text
Owner
-> Marketing Manager
-> Market Radar output
-> Content Creator nhận brief + Radar output
-> Performance Brand nhận brief + Radar output + Content output
-> Owner approve/reject từng RUN_ID
```

Các bot không phụ thuộc việc Telegram chuyển message từ bot này sang bot khác. Một orchestrator local điều khiển cả bốn bot và chủ động gửi handoff bằng đúng danh tính bot tương ứng.

## Tech Stack

- Vite + React + TypeScript
- Telegram Bot API long polling
- 9Router/OpenAI-compatible Chat Completions API
- Vitest + jsdom
- Local seed data và `localStorage` cho dashboard MVP

## Cài đặt

Yêu cầu Node.js 20 trở lên.

```bash
npm install
```

Tạo cấu hình local:

```powershell
Copy-Item .env.example .env
```

Điền vào `.env`:

```env
TELEGRAM_MANAGER_BOT_TOKEN=
TELEGRAM_MARKET_RADAR_BOT_TOKEN=
TELEGRAM_CONTENT_CREATOR_BOT_TOKEN=
TELEGRAM_PERFORMANCE_BRAND_BOT_TOKEN=
TELEGRAM_GROUP_ID=
OPERATOR_TELEGRAM_USER_ID=

NINE_ROUTER_ENABLED=true
NINE_ROUTER_BASE_URL=http://localhost:20128/v1
NINE_ROUTER_MODEL=cx/gpt-5.4-mini
NINE_ROUTER_API_KEY=
NINE_ROUTER_TIMEOUT_MS=30000
NINE_ROUTER_MAX_RETRIES=1
```

`NINE_ROUTER_API_KEY` có thể để trống khi proxy local không yêu cầu key. `.env` đã được ignore và tuyệt đối không được đưa lên GitHub.

## Thiết lập Telegram lần đầu

1. Tạo bốn bot bằng `@BotFather`.
2. Thêm bốn bot vào một Telegram group riêng.
3. Trong BotFather, dùng `/setprivacy`, chọn Marketing Manager Bot và chọn `Disable` để bot nhận yêu cầu ngôn ngữ tự nhiên trong group.
4. Điền bốn token vào `.env`.
5. Tạm để trống `TELEGRAM_GROUP_ID` và `OPERATOR_TELEGRAM_USER_ID`.
6. Chạy bot và gửi `/whoami` trong group.
7. Điền hai ID bot trả về vào `.env`.
8. Khởi động lại bot.
9. Chạy `/health` để xác nhận trạng thái.

Khi thiếu group/operator ID, hệ thống hoạt động theo nguyên tắc fail-closed: chỉ `/whoami` dùng được để hoàn tất cấu hình; các lệnh nghiệp vụ bị từ chối.

Cập nhật tên, mô tả và command menu của bốn bot:

```bash
npm run telegram:setup
```

## Chạy hệ thống

Terminal 1, chạy dashboard:

```bash
npm run dev
```

Terminal 2, chạy bốn Telegram bot:

```bash
npm run telegram:bot
```

Bot sử dụng long polling nên MVP không cần webhook, domain công khai hoặc SSL.

## Command Telegram

Marketing Manager Bot:

```text
/brief
/flow
/campaign <mục tiêu chiến dịch>
/tasks
/run <TASK_ID>
/approve <RUN_ID>
/reject <RUN_ID> <lý do cần sửa>
/health
/report
/whoami
```

Market Radar Bot:

```text
/trend <chủ đề>
/competitor <chủ đề>
/audience <chủ đề>
/insight <chủ đề>
/angle <chủ đề>
```

Content Creator Bot:

```text
/post <brief>
/caption <brief>
/script <brief>
/calendar <brief>
/hook <brief>
```

Performance Brand Bot:

```text
/review <nội dung hoặc chiến dịch>
/brandcheck <nội dung>
/cta <nội dung>
/measure <chiến dịch>
/report
```

Tin nhắn tự nhiên không có slash được Marketing Manager xem như một yêu cầu `/campaign`.

## Kịch bản demo chuẩn

1. Mở dashboard và Telegram group.
2. Gửi `/health` để chứng minh bốn bot, AI provider và khóa quyền đã sẵn sàng.
3. Gửi:

```text
/campaign Tạo chiến dịch giới thiệu dịch vụ AI Agent cho doanh nghiệp nhỏ, kênh Facebook, mục tiêu đặt lịch tư vấn
```

4. Quan sát Market Radar trả insight.
5. Quan sát Content Creator sử dụng insight để tạo bản nháp.
6. Quan sát Performance Brand review insight và bản nháp, đề xuất KPI.
7. Chọn một `RUN_ID` và gửi:

```text
/reject RUN_ID CTA chưa đủ rõ và chưa gắn với lịch tư vấn
```

8. Chạy lại phần cần sửa, sau đó gửi:

```text
/approve RUN_ID
```

9. Dùng `/report` và dashboard để trình bày trạng thái, evidence và human-in-the-loop.

## Khả năng chịu lỗi

- AI request có timeout và retry giới hạn.
- Provider lỗi, timeout hoặc trả rỗng sẽ chuyển sang output mô phỏng có ghi rõ nguồn.
- Telegram polling lỗi tạm thời sẽ retry theo exponential backoff tối đa 30 giây.
- Nội dung Markdown thô được làm sạch trước khi gửi Telegram.
- Log runtime không ghi token và không ghi toàn bộ nội dung yêu cầu của người dùng.
- Lỗi command trả mã theo dõi thay vì phơi bày stack trace trong group.

## Kiểm tra chất lượng

```bash
npm run test
npm run typecheck
npm run build
npm run smoke
```

Gate bắt buộc trước Pull Request:

```bash
npm run check
git diff --check
```

## Cấu trúc phần OWNER-A

```text
scripts/telegram-bot.ts                 Long polling và orchestration bốn bot
scripts/telegram-setup.ts               Cấu hình profile/command Telegram
src/integrations/telegramAdapter.ts      Command, task, approval và session state
src/integrations/telegramRuntime.ts      Authorization, output clean, handoff, health
src/integrations/aiProvider.ts           Prompt, 9Router, timeout/retry/fallback
tests/telegramAdapter.test.ts            Manager command và approval tests
tests/marketingTelegramTeam.test.ts      Bốn vai trò marketing tests
tests/telegramRuntime.test.ts            Security/runtime helper tests
tests/aiProvider.test.ts                 AI provider tests
```

## Cộng tác hai người

Nguồn sự thật chính:

- `docs/PHAN_CONG_2_NGUOI_TELEGRAM_AGENT_MARKETING_KHOA_LUAN.md`
- `CONTRIBUTING.md`
- `.github/ISSUE_TEMPLATE/feature.md`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `docs/templates/AI_HANDOFF_TEMPLATE.md`

`OWNER-A` phụ trách Telegram và AI runtime. `OWNER-B` phụ trách Dashboard, Data Model, UI và tài liệu. Mọi thay đổi `src/domain/types.ts`, `src/domain/operations.ts`, `.env.example` hoặc `package.json` cần review chéo.

## Phần còn mock

- Session Telegram hiện nằm trong RAM và mất khi process restart.
- Dashboard dùng seed data/localStorage, chưa đồng bộ realtime với Telegram session.
- Không có publish connector, ads connector hoặc production deployment.
- Khi AI provider không sẵn sàng, output fallback được ghi rõ là mô phỏng local.

## Roadmap sau MVP

1. Persistence dùng SQLite/PostgreSQL cho Campaign, AgentRun, Approval và AuditEvent.
2. API dùng chung để Telegram và Dashboard đọc cùng nguồn dữ liệu.
3. Approval Queue realtime trên dashboard.
4. Contract test giữa Telegram runtime và dashboard.
5. CI chạy test/typecheck/build trên Pull Request.
6. Observability có correlation ID, metrics và log retention policy.

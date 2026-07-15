# AI Agent Marketing Command Center

Hệ thống khóa luận mô phỏng một phòng Marketing AI trong doanh nghiệp: người quản lý chỉ cần chat tiếng Việt với Manager Bot; bộ điều phối trung tâm phân việc cho sáu Agent, giữ trạng thái chiến dịch, yêu cầu phê duyệt ở từng cổng và lưu audit trail. Telegram là kênh điều hành, dashboard là phòng làm việc trực quan, 9Router cung cấp model và Meta Graph API là cổng vận hành Fanpage có bảo vệ.

## Sáu nhân sự AI

| Agent | Vai trò doanh nghiệp | Đầu ra chịu trách nhiệm |
|---|---|---|
| AI Marketing Manager | Marketing Lead | Nhận mục tiêu, chia stage, tổng hợp và quản lý phê duyệt |
| Market Intelligence | Market Research | Audience, pain point, đối thủ, trend, insight và angle |
| Content Creator | Copywriter | Hook, thông điệp, bài social, CTA và content package |
| Content Strategy & Creative | Content Strategist/Creative Director | Creative direction, visual brief, storyboard, asset checklist và biến thể |
| Brand & Performance | Brand/Performance Lead | Tone, claim, compliance, CTA, KPI và go/no-go |
| Page Growth & Community | Page/Community Executive | Lịch đăng, community inbox, bằng chứng publish và metrics |

Các bot là sáu danh tính giao tiếp. Một orchestrator TypeScript mới là nguồn sự thật; Telegram không được dùng như message bus bot-to-bot vì Telegram không bảo đảm bot nhận tin của bot khác và cách đó khó kiểm toán.

## Luồng chuẩn

```text
Admin chat mục tiêu
  -> Manager tạo campaign
  -> Market Intelligence tạo Research Package -> Admin duyệt
  -> Content Creator tạo Content Package -> Admin duyệt
  -> Content Strategy & Creative tạo Creative Package -> Admin duyệt
  -> Brand & Performance kiểm định -> Admin duyệt
  -> Manager tạo Final Package -> Admin duyệt
  -> Page Growth tạo publication preview -> Admin xác nhận lần cuối
  -> Meta Graph publish có bằng chứng -> đo lường -> đề xuất tối ưu
```

Mọi bước đăng bài, trả lời nội dung nhạy cảm, chạy ads, chi tiền, xóa/chặn, merge hoặc deploy đều không được tự động thực hiện.

## Tech stack

- React 18, Vite 6, TypeScript, Lucide
- Telegram Bot API long polling
- 9Router/OpenAI-compatible Chat Completions
- Meta Graph API v23.0
- Zod strict schema validation cho output Agent
- Local atomic JSON runtime state
- Local HTTP/SSE control API tại `127.0.0.1:8787`
- Vitest, jsdom và Playwright CLI

## Cài đặt

```powershell
npm install
Copy-Item .env.example .env
```

Điền sáu Telegram token, group/operator ID và cấu hình 9Router. Với Meta, luôn bắt đầu bằng:

```env
META_GRAPH_API_VERSION=v23.0
META_PUBLISH_ENABLED=false
META_AUTO_REPLY_ENABLED=false
```

`.env` bị Git ignore. Token từng xuất hiện trong chat/ảnh phải được rotate trước khi mở publish production.

## Chạy local

Mở ba terminal:

```powershell
npm run dev -- --port 5174
npm run control:api
npm run telegram:bot
```

Thiết lập profile/menu Telegram (chỉ chạy khi mới tạo bot hoặc đổi menu):

```powershell
npm run telegram:setup
```

Dashboard: `http://127.0.0.1:5174/`

## Chat không cần lệnh slash

Manager hiểu các ý định vận hành phổ biến:

```text
Hãy tạo chiến dịch ứng dụng AI Agent cho doanh nghiệp SME, kênh Facebook, mục tiêu đặt lịch tư vấn.
Có gì đang chờ tôi duyệt?
Duyệt.
Không duyệt vì CTA chưa rõ và thiếu bằng chứng.
Sửa lại theo hướng có một CTA đặt lịch duy nhất.
Tình hình chiến dịch thế nào?
Chuẩn bị đăng chiến dịch CMP-...
Xác nhận đăng CMP-...
```

`Duyệt` chỉ tự chọn khi đúng một RUN đang chờ. Nếu có 0 hoặc nhiều RUN, Manager hỏi lại mã cụ thể. Các lệnh slash vẫn được giữ làm phương án dự phòng.

## Chăm sóc khách hàng

- Auto-reply mặc định tắt.
- Chỉ FAQ đã được duyệt mới đủ điều kiện tạo câu trả lời tự động.
- Giá/báo giá, khiếu nại, hoàn tiền, dữ liệu cá nhân, pháp lý, bảo mật và câu hỏi mơ hồ luôn chuyển người quản lý.
- Không tự xóa bình luận, chặn người dùng hoặc gửi dữ liệu nhạy cảm.

## Kiểm tra chất lượng

```powershell
npm run test
npm run typecheck
npm run build
npm run smoke
npm run audit:system
git diff --check
```

## Thư mục chính

```text
scripts/telegram-bot.ts                  Bộ điều phối sáu bot
scripts/telegram-setup.ts                Profile và menu Telegram
scripts/control-api.ts                   API local cho dashboard
src/integrations/marketingWorkflow.ts    Stage-gate và publication state
src/integrations/managerIntent.ts        Hiểu ý định tiếng Việt
src/integrations/aiProvider.ts            Prompt vai trò và 9Router
src/integrations/metaGraphAdapter.ts      Meta read/publish guard
src/integrations/customerCarePolicy.ts   Chính sách CSKH
src/features/agent-office/               Phòng Agent trực quan
docs/operations/                          Kịch bản demo và readiness
```

## Trạng thái production

Chạy local và demo stage-gate được. Để bật Meta production cần rotate token, Meta App ID/Secret, quyền Page đã review, webhook HTTPS công khai, verify token, signature verification, database và monitoring. Xem `docs/operations/META_PRODUCTION_READINESS.md`.

Báo cáo trung thực theo từng năng lực và định hướng sử dụng LangGraph/Temporal/Trigger.dev/OpenTelemetry nằm tại `docs/operations/PRODUCTION_READINESS_AUDIT.md`.

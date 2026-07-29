# AI Agent Marketing Command Center

Hệ thống khóa luận mô phỏng một phòng Marketing AI trong doanh nghiệp: người quản lý chỉ cần chat tiếng Việt với Manager Bot; bộ điều phối trung tâm phân việc cho sáu Agent, tự bàn giao nội bộ theo chính sách rủi ro và lưu audit trail. Telegram là kênh điều hành, dashboard là phòng làm việc trực quan, 9Router cung cấp model và Meta Graph API là cổng vận hành Fanpage có bảo vệ.

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
  -> Market Intelligence tạo Research Package -> Policy Engine kiểm tra và tự bàn giao
  -> Content Creator tạo Content Package -> Policy Engine kiểm tra và tự bàn giao
  -> Content Strategy & Creative tạo Creative Package -> Policy Engine kiểm tra và tự bàn giao
  -> Brand & Performance kiểm định -> Policy Engine kiểm tra và tự bàn giao
  -> Manager tạo Final Package -> Admin duyệt
  -> Page Growth tự lấy đúng publication_content đã duyệt và gửi publication preview
  -> Admin xác nhận lần cuối
  -> Meta Graph publish có bằng chứng -> đo lường -> đề xuất tối ưu
```

Mọi bước đăng bài, trả lời nội dung nhạy cảm, chạy ads, chi tiền, xóa/chặn, merge hoặc deploy đều không được tự động thực hiện.

Dashboard không chỉ để xem: qua Control API (write-path có bảo vệ token) người vận hành có thể **khởi chạy chiến dịch, duyệt, từ chối, xác nhận đăng** ngay trên giao diện — cùng điều khiển một state machine với Telegram.

## Năng lực nghiệp vụ (F01–F12)

| Mã | Chức năng | Module |
|---|---|---|
| F02 | Nghiên cứu thị trường (insight có nguồn) | `marketResearch.ts` |
| F03 | Theo dõi đối thủ (diff + chống trùng) | `competitorMonitor.ts` |
| F06 | Tạo video (guarded, mock fallback) | `videoGenerationAdapter.ts` |
| F10 | Chăm sóc cộng đồng (+ che PII) | `communityInbox.ts` |
| F11/F12 | Đo lường + Learning Package | `campaignAnalytics.ts` |

Mỗi module có domain type (Zod), logic thuần và read model đã redacted phơi qua Control API.

## Agent Intelligence Stack (chuẩn ngành 2026)

Đủ 7 mối quan tâm lõi của agent stack hiện đại:

| Concern | Hiện thực |
|---|---|
| Orchestration | Stage-gate state machine + HITL checkpoint + recovery (`marketingWorkflow.ts`, `campaignOrchestrator.ts`) |
| Governance | Policy tự duyệt + guarded adapter + audit + 2-lớp phê duyệt |
| Models | Định tuyến model theo agent (`modelRouter.ts`) — việc khó→mạnh, nhẹ→rẻ |
| Knowledge (RAG) | Brand Knowledge Base + retrieval BM25-lite (`knowledgeBase.ts`) — agent bám dữ liệu thật |
| Eval | Judge độc lập (LLM-as-judge + heuristic), chặn claim phóng đại (`agentEval.ts`) |
| Observability | Trace/span mỗi lượt agent + chi phí + drift (`telemetry.ts`, `GET /api/telemetry`) |
| Memory | Ký ức chiến dịch dài hạn, agent học từ lịch sử (`campaignMemory.ts`, `GET /api/memory`) |

Tất cả chạy mock/heuristic khi chưa có key và tự bật chế độ thật khi cắm `NINE_ROUTER_API_KEY` — không cần sửa code.

## Tech stack

- React 18, Vite 6, TypeScript (strict), Lucide
- Telegram Bot API long polling
- 9Router/OpenAI-compatible Chat Completions + định tuyến model theo tier
- Meta Graph API v23.0 (guarded)
- Zod strict schema validation cho mọi input ngoài
- Persistence: atomic JSON runtime state + backup xoay vòng (10 bản)
- Control API `node:http` (GET read model + SSE + POST write-path) phục vụ luôn dashboard tĩnh khi build
- Bảo mật: bearer-token auth cho write-path, rate-limit per-IP, security headers, config validation (Zod), structured logging có redaction
- Đóng gói: Docker multi-stage 1-container (dashboard + API cùng origin)
- Vitest (172 test), jsdom và Playwright CLI

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
MARKETING_APPROVAL_MODE=enterprise-risk-based
```

`.env` bị Git ignore. Token từng xuất hiện trong chat/ảnh phải được rotate trước khi mở publish production.

## Chạy local

Mở ba terminal (dev server 5173, `npm run dev` là đủ — CORS cho phép mọi origin loopback):

```powershell
npm run dev
npm run control:api
npm run telegram:bot
```

Xem toàn luồng chạy thử một lệnh (mock, không cần key):

```powershell
npm run demo:golden
```

Thiết lập profile/menu Telegram (chỉ chạy khi mới tạo bot hoặc đổi menu):

```powershell
npm run telegram:setup
```

Dashboard: `http://127.0.0.1:5173/`

## Triển khai production (self-hosted, 1 doanh nghiệp)

Một container phục vụ cả dashboard lẫn Control API cùng origin:

```bash
echo "CONTROL_API_TOKEN=$(node -e "console.log(require('crypto').randomBytes(24).toString('hex'))")" > .env
docker compose up -d --build
# Mở http://<IP-máy-chủ>:8787 -> nhập token -> điều khiển thật
```

Hướng dẫn đầy đủ (backup, HTTPS/reverse proxy, cắm key thật): `docs/operations/DEPLOYMENT.md`.

## Chat không cần lệnh slash

Manager hiểu các ý định vận hành phổ biến:

```text
Hãy tạo chiến dịch ứng dụng AI Agent cho doanh nghiệp SME, kênh Facebook, mục tiêu đặt lịch tư vấn.
Có gì đang chờ tôi duyệt?
Duyệt.
Không duyệt vì CTA chưa rõ và thiếu bằng chứng.
Sửa lại theo hướng có một CTA đặt lịch duy nhất.
Tình hình chiến dịch thế nào?
Xác nhận đăng CMP-...
```

Ở chế độ enterprise, `Duyệt` thường chỉ xuất hiện tại Final Package. Research, Content, Creative và Brand tự bàn giao khi đạt điểm từ 80 với recommendation `approve`, hoặc từ 70 với `approve_with_conditions`. Package `revise` được tự sửa một lần; điều kiện còn lại được Brand/Manager xử lý và đưa vào Final. Rủi ro pháp lý, dữ liệu cá nhân, tài chính, khiếu nại hoặc khủng hoảng vẫn bị escalation. `Duyệt` chỉ tự chọn khi đúng một RUN đang chờ; nếu có 0 hoặc nhiều RUN, Manager hỏi lại mã cụ thể. Các lệnh slash vẫn được giữ làm phương án dự phòng.

Final Package bắt buộc có `publication_content`: nguyên văn bài Facebook sẽ được đăng. Workflow từ chối tạo lịch nếu thiếu trường này, vì vậy Meta không thể nhận nhầm brief, checklist hoặc báo cáo nội bộ.

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

**Quy trình nghiệm thu đầy đủ** (3 mức: test tự động → dashboard thật → live với key), có lệnh copy-paste + kết quả kỳ vọng + checklist: `docs/operations/QUY_TRINH_KIEM_THU.md`.

## Thư mục chính

```text
scripts/telegram-bot.ts                  Bộ điều phối sáu bot
scripts/control-api.ts                   Control API + write-path + phục vụ dashboard
scripts/demo-golden-sequence.ts          Demo F01-F12 một lệnh (mock)
src/integrations/marketingWorkflow.ts    Stage-gate và publication state
src/integrations/campaignOrchestrator.ts Điều phối vòng đời (không cần Telegram)
src/integrations/managerIntent.ts        Hiểu ý định tiếng Việt
src/integrations/aiProvider.ts           Prompt vai trò và 9Router
src/integrations/modelRouter.ts          Định tuyến model theo agent
src/integrations/knowledgeBase.ts        Brand Knowledge Base + RAG
src/integrations/agentEval.ts            Eval độc lập (judge)
src/integrations/telemetry.ts            Trace/span + chi phí
src/integrations/campaignMemory.ts       Ký ức chiến dịch dài hạn
src/integrations/metaGraphAdapter.ts     Meta read/publish guard
src/config/appConfig.ts · src/lib/logger.ts   Config validation + logging
src/features/agent-office/               Phòng Agent trực quan
docs/operations/DEPLOYMENT.md            Hướng dẫn triển khai Docker
docs/MA_TRAN_TRUY_VET_F01_F12.md         Ma trận truy vết chức năng
```

## Trạng thái production

Chạy local và demo stage-gate được. Để bật Meta production cần rotate token, Meta App ID/Secret, quyền Page đã review, webhook HTTPS công khai, verify token, signature verification, database và monitoring. Xem `docs/operations/META_PRODUCTION_READINESS.md`.

Báo cáo trung thực theo từng năng lực và định hướng sử dụng LangGraph/Temporal/Trigger.dev/OpenTelemetry nằm tại `docs/operations/PRODUCTION_READINESS_AUDIT.md`.

## Tài liệu khóa luận và trình bày

- Tài liệu nguồn có đầy đủ Mermaid diagram: `docs/TAI_LIEU_THIET_KE_VA_TRINH_BAY_HE_THONG_AI_AGENT_MARKETING_2026.md`.
- Bản Word 31 trang: `docs/AI_Agent_Marketing_Command_Center_Thesis_Design_2026.docx`.
- Bản PDF kiểm tra trình bày: `docs/AI_Agent_Marketing_Command_Center_Thesis_Design_2026.pdf`.
- Tạo lại sơ đồ và Word bằng `npm run docs:thesis`.

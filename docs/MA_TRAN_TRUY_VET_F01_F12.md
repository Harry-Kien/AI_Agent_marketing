# Ma trận truy vết F01–F12

Bảng truy vết chứng minh mọi chức năng nghiệp vụ (F01–F12) đều có **hiện thực code → endpoint → test → sơ đồ → cách tái lập bằng chứng**. Dùng khi bảo vệ khóa luận để trả lời "chức năng X nằm ở đâu, kiểm chứng thế nào".

Cập nhật: 2026-07-21 · Trạng thái: 21 test files / 126 test passed · typecheck + build sạch.

## 1. Ma trận chức năng

| Mã | Chức năng | Module hiện thực | Endpoint read-only | Test | Sơ đồ | Bằng chứng chạy |
|----|-----------|------------------|--------------------|------|-------|-----------------|
| F01 | Nhận yêu cầu tiếng Việt | `managerIntent.ts` | (Telegram) | `managerIntent.test.ts`, `marketingTelegramTeam.test.ts` | Use case (6), Sequence (11) | `demo:golden` Bước 1 |
| F02 | Nghiên cứu thị trường | `marketResearch.ts` | `GET /api/market-research` | `marketResearch.test.ts` | Kiến trúc thành phần (9), DFD (15.2) | `demo:golden` Bước 6 |
| F03 | Theo dõi đối thủ | `competitorMonitor.ts` | `GET /api/competitors` | `competitorMonitor.test.ts` | Kiến trúc thành phần (9), DFD (15.2) | `demo:golden` Bước 5 |
| F04 | Lập chiến dịch | `marketingWorkflow.ts` | `GET /api/runtime` | `marketingWorkflow.test.ts`, `goldenSequence.test.ts` | State machine (17) | `demo:golden` Bước 2–3 |
| F05 | Tạo nội dung | `aiProvider.ts` (content-creator), `agentWorkProduct.ts` | `GET /api/runtime` | `aiProvider.test.ts`, `agentWorkProduct.test.ts` | Sequence chuẩn (11) | `demo:golden` Bước 3 |
| F06 | Tạo video sản phẩm | `videoGenerationAdapter.ts` | `GET /api/video-studio` | `videoGenerationAdapter.test.ts` | Kiến trúc thành phần (9) | `demo:golden` Bước 7 |
| F07 | Kiểm định chất lượng | `aiProvider.ts` (performance-brand), `approvalPolicy.ts` | `GET /api/runtime` | `approvalPolicy.test.ts`, `aiProvider.test.ts` | Sequence auto-revision (12) | `demo:golden` Bước 3 (Brand) |
| F08 | Phê duyệt | `approvalPolicy.ts`, `workflowApproval.ts` | `GET /api/runtime` | `approvalPolicy.test.ts`, `enterpriseSequence.test.ts` | Sequence auto-revision (12) | `demo:golden` Bước 3–4 |
| F09 | Đăng Facebook | `metaGraphAdapter.ts`, `marketingWorkflow.ts` | `GET /api/runtime` | `metaGraphAdapter.test.ts`, `goldenSequence.test.ts` | Sequence xuất bản an toàn (13) | `demo:golden` Bước 4 |
| F10 | Chăm sóc khách hàng | `communityInbox.ts`, `customerCarePolicy.ts` | `GET /api/community` | `communityInbox.test.ts`, `customerCarePolicy.test.ts` | Luồng CSKH (14) | `demo:golden` Bước 9 |
| F11 | Đo lường | `campaignAnalytics.ts` | `GET /api/analytics` | `campaignAnalytics.test.ts` | Kiến trúc thành phần (9) | `demo:golden` Bước 8 |
| F12 | Tự cải tiến | `campaignAnalytics.ts` (LearningPackage) | `GET /api/analytics` | `campaignAnalytics.test.ts` | Kiến trúc thành phần (9) | `demo:golden` Bước 8 |

## 2. Yêu cầu phi chức năng

| Thuộc tính | Hiện thực | Test |
|------------|-----------|------|
| Persistence + phục hồi sau restart | `telegramStateStore.ts` (atomic write, quarantine bản hỏng) | `telegramStateStore.test.ts` |
| Idempotency (chống trùng update) | `telegramStateStore.ts` (`processedUpdateIds`) | `telegramStateStore.test.ts`, `telegramRuntime.test.ts` |
| Chống cảnh báo trùng (đối thủ) | `competitorMonitor.ts` (`dedupKey`) | `competitorMonitor.test.ts` |
| Guarded external actions | `metaGraphAdapter.ts`, `videoGenerationAdapter.ts` | `metaGraphAdapter.test.ts`, `videoGenerationAdapter.test.ts` |
| Redaction / không lộ secret & PII | `controlApi.ts` read model, `communityInbox.ts` (`redactPii`) | `controlApi.test.ts`, `communityInbox.test.ts`, `competitorMonitor.test.ts` |
| Human-in-the-loop 2 cổng | `marketingWorkflow.ts` (Final ≠ Publication) | `goldenSequence.test.ts`, `enterpriseSequence.test.ts` |

## 3. Cách tái lập bằng chứng

```bash
npm run demo:golden   # chạy full F01–F12 ở chế độ mock, in bằng chứng từng bước
npm run test          # 126 test (21 files) — happy + failure path
npm run typecheck     # tsc -b
npm run build         # production build
npm run docs:thesis   # sinh lại 13 sơ đồ + thesis docx
```

Chạy live (cần cấu hình `.env`): `npm run control:api` + `npm run telegram:bot` + `npm run audit:system`.

## 4. Ánh xạ 6 Agent ↔ chức năng

| Agent | Chức năng phụ trách |
|-------|---------------------|
| Marketing Manager | F01, F04, F08 (điều phối, tạo Final, phê duyệt) |
| Market Radar | F02, F03 |
| Content Creator | F05 |
| Strategy & Creative | F06 |
| Brand & Performance | F07, F11, F12 |
| Page Growth & Community | F09, F10 |

# Đề án Doanh nghiệp 1 người — Phòng Marketing AI (Ngoc Son Group)

> Tài liệu tổng quan dự án để báo cáo & cập nhật Myxteam. Nguồn kỹ thuật: README, `docs/TAI_LIEU_THIET_KE_VA_TRINH_BAY_HE_THONG_AI_AGENT_MARKETING_2026.md`, `docs/MA_TRAN_TRUY_VET_F01_F12.md`, `CLAUDE.md`.

## 1. Ý tưởng: "Doanh nghiệp 1 người"

Một người vận hành cả một công ty nhờ **đội AI Agent** làm việc thay các phòng ban. Điều khiển qua **Telegram** (chat tiếng Việt tự nhiên); con người chỉ giữ các **quyết định then chốt** (duyệt, xác nhận đăng). Đây là mô hình **human-in-the-loop**.

Cấu trúc "bot điều khiển các bot": một **Orchestrator** (bộ não trung tâm) nhận lệnh và điều phối **6 AI Agent** chuyên trách, tự bàn giao nội bộ theo chính sách, và lưu **audit trail** cho mọi hành động.

## 2. Trạng thái hiện tại — Phòng Marketing đã chạy được

Phòng ban đầu tiên đã hoàn thiện là **Marketing**, gồm 12 năng lực F01–F12 (nhận yêu cầu → nghiên cứu → lập chiến dịch → nội dung/video → kiểm định → duyệt → đăng Facebook → CSKH → đo lường → tự cải tiến).

| Thành phần | Trạng thái |
|-----------|-----------|
| 6 AI Agent + Orchestrator (Telegram) | ✅ chạy được |
| Dashboard điều hành realtime + write-path | ✅ chạy được (verify trình duyệt) |
| Bảo mật production (auth token, rate-limit, headers) | ✅ |
| Triển khai Docker 1-container | ✅ |
| Kiểm thử | ✅ 188 test pass |

**Agent Intelligence Stack đạt 7/7 concern chuẩn ngành 2026:** orchestration (stage-gate + HITL), governance (guardrail + audit), model routing, RAG (hybrid dense+BM25), eval độc lập, observability (trace + cost), memory dài hạn.

## 3. Bộ não điều khiển — có thể dùng Claude

"Bộ não" của mỗi Agent là một mô hình ngôn ngữ (LLM), cắm qua lớp `aiProvider` **provider-neutral** (chuẩn OpenAI-compatible). Do đó có thể dùng **Claude (Anthropic)** làm bộ não:

**Cách 1 — qua gateway OpenAI-compatible (không sửa code):** đặt trong `.env` model Claude cho từng tier; module định tuyến model tự chọn đúng model cho đúng Agent.

| Tier | Agent | Model Claude đề xuất |
|------|-------|---------------------|
| strong | Marketing Manager, Brand & Performance | `claude-opus-5` |
| balanced | Market Radar, Content Creator, Strategy & Creative | `claude-sonnet-5` |
| light | Page Growth & Community | `claude-haiku-4-5` |

```env
MODEL_STRONG=claude-opus-5
MODEL_BALANCED=claude-sonnet-5
MODEL_LIGHT=claude-haiku-4-5
NINE_ROUTER_API_KEY=<key-gateway-hỗ-trợ-Claude>
```

**Cách 2 — adapter Claude native (Anthropic SDK):** thêm một provider dùng Messages API (`claude-opus-5`, adaptive thinking, streaming, tool-use). Mạnh và kiểm soát tốt hơn; cần bổ sung code (một sprint nhỏ).

> Khuyến nghị: bắt đầu bằng **Cách 1** để thử Claude ngay, sau nâng lên Cách 2 nếu cần streaming/tool-use sâu.

## 4. Bức tranh mở rộng — từ 1 phòng thành cả công ty

Kiến trúc đã tách sạch (domain type + module năng lực + read-model qua Control API), nên **nhân bản sang phòng ban khác** theo cùng khuôn:

```
Orchestrator (bộ não) ──┬── Phòng Marketing (✅ đã có: 6 agent, F01–F12)
                        ├── Phòng Kinh doanh/Sales (lộ trình)
                        ├── Phòng CSKH mở rộng (lộ trình)
                        └── Phòng Vận hành/Ops (lộ trình)
```

Mỗi phòng ban mới = thêm các "module năng lực" + agent theo đúng pattern hiện có (đã có sẵn 5 module mẫu F02/F03/F06/F10/F11), dùng chung: policy duyệt, audit, model routing, RAG, eval, observability, memory.

## 5. Lộ trình đề xuất (đưa vào Myxteam)

| Giai đoạn | Nội dung | Cần gì |
|-----------|----------|--------|
| **GĐ0 — Đang có** | Phòng Marketing chạy được (mock) | Không |
| **GĐ1 — Live MKT** | Cắm Claude (Cách 1) + Telegram + Meta thật | Key Claude/gateway, 6 bot token, Meta App Review |
| **GĐ2 — Dữ liệu thật** | Đổ `brand-knowledge.json` của Ngoc Son + bật embedding (RAG semantic) | File dữ liệu + key embedding |
| **GĐ3 — Nhân bản phòng ban** | Thêm Sales/CSKH/Ops theo khuôn Marketing | Thiết kế từng phòng |

## 6. Tài liệu tham chiếu (đã có trong repo)

- Thiết kế hệ thống + 13 sơ đồ: `docs/TAI_LIEU_THIET_KE_VA_TRINH_BAY_HE_THONG_AI_AGENT_MARKETING_2026.md` (+ bản `.docx`)
- Ma trận truy vết F01–F12: `docs/MA_TRAN_TRUY_VET_F01_F12.md`
- Quy trình nghiệm thu: `docs/operations/QUY_TRINH_KIEM_THU.md`
- Triển khai: `docs/operations/DEPLOYMENT.md`
- Hướng dẫn cho AI/developer: `CLAUDE.md`, `README.md`

## 7. Tóm tắt để báo cáo

- **Có dùng Claude điều khiển dàn agent được** — qua gateway (không sửa code) hoặc adapter native.
- Phòng Marketing **đã chạy được, kiểm thử đầy đủ, deploy được**.
- Kiến trúc **sẵn sàng nhân bản** thành các phòng ban khác của "doanh nghiệp 1 người".
- Việc còn lại chủ yếu là **cấu hình (key, token, dữ liệu thật)**, không phải viết lại.

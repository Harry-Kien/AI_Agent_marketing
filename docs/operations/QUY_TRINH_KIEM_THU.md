# Quy trình kiểm thử & nghiệm thu hệ thống

Tài liệu này hướng dẫn kiểm tra hệ thống **có hoạt động thật không**, theo 3 mức từ dễ đến live. Mỗi bước có **lệnh copy-paste** và **kết quả kỳ vọng** để bạn tự đối chiếu.

> Nguyên tắc: nếu kết quả thực tế khớp cột "kỳ vọng" → **ĐẠT**. Nếu lệch → xem mục Xử lý sự cố cuối trang.

---

## 0. Chuẩn bị (1 lần)

```bash
npm install
```

Kỳ vọng: cài xong, không lỗi đỏ.

> Lưu ý test trên Windows: lần chạy `npm run test` **đầu tiên sau khi đổi file** đôi khi báo `no tests` (esbuild nguội) — **chạy lại lần 2 là chuẩn**. Đây là hiện tượng môi trường, không phải lỗi code.

---

## MỨC 1 — Kiểm thử tự động (không cần cấu hình gì)

Mục tiêu: xác nhận code, luồng, logic đều đúng.

### 1.1. Chạy toàn bộ test + typecheck + build
```bash
npm run check
```
| Kỳ vọng | ĐẠT khi |
|---------|---------|
| `Tests  188 passed (188)` | Tất cả test xanh |
| `tsc -b` không lỗi | Typecheck sạch |
| `built in ...` | Build thành công |

### 1.2. Chạy demo toàn luồng F01→F12 (mock, bấm-là-chạy)
```bash
npm run demo:golden
```
Kỳ vọng — in ra 10 bước và dòng cuối:
```
✅ NHẤT QUÁN — luồng chạy trọn vẹn
```
Cần thấy: 6 agent qua 5 cổng → `published` (có `postId`) → 5 module năng lực → 1 campaignId xuyên suốt.

**→ ĐẠT mức 1 = logic & luồng đúng.**

---

## MỨC 2 — Kiểm thử vận hành thật qua Dashboard (không cần API key)

Mục tiêu: xác nhận điều khiển được hệ thống bằng giao diện, dữ liệu chạy backend thật.

### 2.1. Khởi động (2 cửa sổ terminal)
```bash
# Terminal 1 — backend
npm run control:api
# Terminal 2 — dashboard
npm run dev
```
Kỳ vọng terminal 1 (log JSON):
```
"message":"Marketing Control API sẵn sàng: http://127.0.0.1:8787"
"message":"Brand knowledge base đã nạp" ... "retrieval":"BM25 (chưa cắm embedding)"
```
> `BM25 (chưa cắm embedding)` là ĐÚNG khi chưa có key — hệ vẫn chạy.

### 2.2. Mở dashboard
Mở trình duyệt: **http://127.0.0.1:5173/**

| Kiểm tra | Kỳ vọng |
|----------|---------|
| Console trình duyệt (F12) | **0 lỗi CORS** |
| Tab Tổng quan → thẻ trạng thái | **"Realtime"** (không phải "Dữ liệu mẫu") |

### 2.3. Chạy một chiến dịch từ đầu tới đăng
1. Tab **Tổng quan** → ô "Khởi chạy chiến dịch mới" → gõ: *"Chiến dịch Facebook cho phần mềm kế toán AI, thu lead SME"* → bấm **Khởi chạy chiến dịch**.
   - Kỳ vọng: xuất hiện **Mã chiến dịch CMP-...**, giai đoạn **research pending approval**; pipeline: "Tiếp nhận" ✓ → "Nghiên cứu" (đang chạy).
2. Ở **Bàn phê duyệt** → bấm **Duyệt & Chuyển Stage** vài lần.
   - Kỳ vọng: giai đoạn tiến dần research → content → creative → brand → final; mỗi bước hiện gói công việc thật.
3. Khi tới **publication_pending_confirmation** → bấm **Xác nhận đăng**.
   - Kỳ vọng: giai đoạn → **published**.

### 2.4. Vòng lặp "đối thủ → chiến dịch phản công"
Tab **Đối thủ cạnh tranh** → bấm **Đề xuất phản hồi chiến dịch** (thẻ AI Agency X).
- Kỳ vọng: thẻ chuyển xanh **"✓ Đã gửi sang Strategy Agent xử lý"**; sang tab Tổng quan thấy **chiến dịch mới** "Chiến dịch phản hồi đối thủ AI Agency X...".

### 2.5. Chăm sóc & Lead
Tab **Chăm sóc & Lead** → chọn 1 tin → sửa nội dung nháp → **Duyệt gửi phản hồi**.
- Kỳ vọng: tin chuyển trạng thái "đã gửi"; terminal backend log `"Phản hồi cộng đồng đã duyệt"`.

### 2.6. Quan sát vận hành (observability)
Tab **Vận hành hệ thống**.
| Kiểm tra | Kỳ vọng |
|----------|---------|
| Nguồn dữ liệu | **Realtime** |
| Chi phí AI lũy kế | có số `$0.000...` (>0 sau khi chạy chiến dịch) |
| Bảng trace | có dòng mỗi agent: role, **model tier**, eval, verdict `pass` |
| Ký ức chiến dịch | đếm tăng sau khi có chiến dịch **published** |

**→ ĐẠT mức 2 = điều khiển thật được từ giao diện.**

---

## MỨC 3 — Kiểm thử LIVE với dữ liệu/tài khoản thật

Mục tiêu: xác nhận hệ "sống" với AI thật, dữ liệu brand thật, Telegram/Facebook thật.

### 3.1. Bảo vệ write-path bằng token (bắt buộc khi dùng thật)
Tạo `.env`:
```bash
echo "CONTROL_API_TOKEN=$(node -e "console.log(require('crypto').randomBytes(24).toString('hex'))")" > .env
```
Khởi động lại `npm run control:api`. Kiểm tra:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:8787/api/campaigns -H "content-type: application/json" -d "{\"brief\":\"x\"}"
```
- Kỳ vọng: **401** (không có token → bị chặn). Trên dashboard, nhập token vào ô ở tab Tổng quan thì nút mới hoạt động.

### 3.2. AI thật (thay mock)
Thêm vào `.env`:
```env
NINE_ROUTER_API_KEY=<key-cua-ban>
NINE_ROUTER_MODEL=<model>
```
Chạy lại. Kỳ vọng: ở tab Vận hành, cột model **mode = ai** (không còn `mock`); output agent do LLM thật sinh.

### 3.3. RAG ngữ nghĩa thật (embedding)
Chuẩn bị dữ liệu brand:
```bash
cp data/brand-knowledge.sample.json data/brand-knowledge.json   # sửa theo sản phẩm/giá thật của bạn
```
Thêm `.env`:
```env
BRAND_KNOWLEDGE_PATH=data/brand-knowledge.json
EMBEDDING_API_KEY=<key>   # hoặc để trống sẽ dùng NINE_ROUTER_API_KEY
```
Chạy lại `npm run control:api`. Kỳ vọng log:
```
"retrieval":"hybrid (dense + BM25)"
```
→ agent giờ tra cứu **ngữ nghĩa** trên dữ liệu thật của bạn.

### 3.4. Telegram thật
Tạo 6 bot với @BotFather, điền token vào `.env` (xem `.env.example`), rồi:
```bash
npm run telegram:setup   # 1 lần
npm run telegram:bot
```
Trong group Telegram, nhắn: *"Hãy tạo chiến dịch Facebook cho SME, mục tiêu thu lead"*.
- Kỳ vọng: Manager tạo campaign, các bot lần lượt nhận việc và trả kết quả; bạn nhắn **Duyệt** / **Xác nhận đăng CMP-...** để qua 2 cổng người.

### 3.5. Facebook thật (guarded)
Chỉ bật sau khi đã xoay token và qua App Review:
```env
META_PAGE_ID=...
META_PAGE_ACCESS_TOKEN=...
META_PUBLISH_ENABLED=true
```
- Kỳ vọng: chỉ nội dung **đã duyệt + xác nhận cuối** mới đăng; lưu `postId` thật. Nếu `META_PUBLISH_ENABLED=false` → bot báo "publish đang khóa an toàn" (đúng chủ đích).

### 3.6. Deploy 1-container (dùng thật lâu dài)
```bash
docker compose up -d --build
# Mở http://<IP-máy-chủ>:8787
```
Xem hướng dẫn đầy đủ: `docs/operations/DEPLOYMENT.md`.

---

## Bảng nghiệm thu tổng (tick khi ĐẠT)

| # | Hạng mục | Lệnh/Thao tác | ĐẠT |
|---|----------|---------------|:--:|
| 1 | Test/typecheck/build | `npm run check` → 188 passed | ☐ |
| 2 | Luồng F01–F12 | `npm run demo:golden` → NHẤT QUÁN | ☐ |
| 3 | Dashboard realtime | mở :5173, 0 lỗi CORS, badge Realtime | ☐ |
| 4 | Tạo → duyệt → đăng | qua giao diện tới `published` | ☐ |
| 5 | Đối thủ → chiến dịch | nút "Đề xuất phản hồi" tạo campaign | ☐ |
| 6 | Observability | tab Vận hành có cost + trace + memory | ☐ |
| 7 | Auth | POST không token → 401 | ☐ |
| 8 | AI thật (tùy chọn) | cắm key → mode=ai | ☐ |
| 9 | RAG semantic (tùy chọn) | log "hybrid (dense + BM25)" | ☐ |
| 10 | Telegram/Meta (tùy chọn) | luồng live qua bot | ☐ |

**Mức khóa luận/dùng nội bộ: cần ĐẠT #1–#7.** #8–#10 là live với tài khoản thật.

---

## Xử lý sự cố thường gặp

| Triệu chứng | Nguyên nhân | Cách xử lý |
|-------------|-------------|-----------|
| `npm run test` báo "no tests" lần đầu | esbuild nguội trên Windows | Chạy lại lần 2 |
| Dashboard toàn "Dữ liệu mẫu", console lỗi CORS | Chưa chạy `control:api`, hoặc sai cổng | Bật `npm run control:api`; dùng `npm run dev` (cổng 5173) |
| Nút bấm không tác động | Thiếu token khi đã đặt `CONTROL_API_TOKEN` | Nhập token vào ô ở tab Tổng quan |
| POST trả 429 | Vượt rate-limit | Chờ vài giây |
| Agent vẫn `mock` dù đã cắm key | `NINE_ROUTER_API_KEY` chưa vào `.env`/chưa khởi động lại | Kiểm tra `.env`, restart `control:api` |
| Log vẫn "BM25 (chưa cắm embedding)" | Chưa có `EMBEDDING_API_KEY` | Cắm key embedding, restart |

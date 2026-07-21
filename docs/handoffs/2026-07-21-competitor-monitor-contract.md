# Biên bản bàn giao — Competitor Monitor (Issue K01)

- Người bàn giao: Kiên (Backend / AI / Telegram)
- Người nhận: Bảo (UI / Dashboard)
- Ngày: 2026-07-21
- Branch: `feature/kien-01-competitor-monitor`

## 1. Tóm tắt

Đã triển khai Competitor Monitor (F03 / K04) theo cơ chế **so sánh hai ảnh chụp** (diff engine) và
**chống cảnh báo trùng** bằng `dedupKey`. Dữ liệu được cung cấp cho dashboard qua endpoint read-only
mới, đã redacted. Chưa làm write-path (nút "Đề xuất phản hồi") — để Issue sau.

## 2. Endpoint mới

```
GET http://127.0.0.1:8787/api/competitors
```

Mẫu phản hồi:

```json
{
  "connected": true,
  "generatedAt": "2026-07-21T10:15:00.000Z",
  "alerts": [
    {
      "id": "ai-agency-x::pricing_change::plan:setup-sme::<hash>",
      "name": "AI Agency X",
      "type": "pricing_change",
      "detail": "Gói thiết lập AI Agent cho SME: 5.0tr/tháng → 4.2tr/tháng (giảm 15%)",
      "impact": "high",
      "time": "10:15",
      "suggestedAction": "Đối thủ AI Agency X vừa đổi giá. Cân nhắc chiến dịch nhấn giá trị..."
    }
  ]
}
```

## 3. Contract cho UI

Shape mỗi `alert` khớp đúng interface `CompetitorAlert` mà `CompetitorList.tsx` đang hardcode:

| Trường | Kiểu | Ghi chú |
|--------|------|---------|
| `id` | string | Ổn định, dùng làm React key. Bằng `dedupKey`. |
| `name` | string | Tên đối thủ |
| `type` | `pricing_change` \| `new_campaign` \| `feature_release` \| `ad_push` | |
| `detail` | string | Mô tả thay đổi (đã gộp giá trị cũ → mới) |
| `impact` | `high` \| `medium` \| `low` | Đã sắp xếp: high trước |
| `time` | string | Đã bản địa hóa `HH:mm` (vi-VN) |
| `suggestedAction` | string | Đề xuất phản hồi (rule-based, sau thay bằng AI) |

Bảo chỉ cần đổi mảng hardcode trong `CompetitorList.tsx` thành `fetch("/api/competitors")`
(pattern y hệt `loadOfficeSnapshot` trong `src/features/agent-office/api.ts`), có fallback khi offline.

## 4. Đã cố tình redacted

Read model **không** chứa: `dedupKey`, `confidence`, `evidence`, `previousValue`, `currentValue`
thô, `source` nội bộ. Có test khẳng định chuỗi JSON không chứa `dedupKey`/`confidence`/`TOKEN`.

## 5. File thay đổi

- `src/domain/competitorTypes.ts` (mới) — type + Zod schema
- `src/integrations/competitorMonitor.ts` (mới) — diff engine, dedup, read model, fixture
- `src/integrations/controlApi.ts` (sửa) — thêm route + option `getCompetitorEvents`
- `tests/competitorMonitor.test.ts` (mới) — 10 test, happy + failure path

## 6. Kiểm chứng

- `npm run test` → 97 passed
- `npm run typecheck` → sạch
- `npm run build` → OK

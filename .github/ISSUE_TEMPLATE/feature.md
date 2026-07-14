---
name: Tính năng
about: Giao một đơn vị công việc có thể kiểm thử cho OWNER-A hoặc OWNER-B
title: "[FEATURE] "
labels: feature
assignees: ""
---

## Giá trị cần tạo

Mô tả vấn đề người dùng/doanh nghiệp và kết quả mong muốn.

## Owner

- [ ] OWNER-A: Telegram và AI Agent runtime
- [ ] OWNER-B: Dashboard, Data và tài liệu
- [ ] Shared contract: bắt buộc hai người duyệt

## Phạm vi

File/module dự kiến được sửa:

```text

```

Ngoài phạm vi:

```text

```

## Hợp đồng đầu vào/đầu ra

Nêu command, type, event, payload hoặc UI state bị ảnh hưởng. Không ghi token hoặc dữ liệu bí mật.

## Acceptance criteria

- [ ] Hành vi chính có thể quan sát và kiểm thử.
- [ ] Failure mode có kết quả rõ ràng.
- [ ] Human approval vẫn được giữ nếu liên quan hành động quan trọng.
- [ ] Không có hành động publish/deploy/merge tự động.
- [ ] Tài liệu được cập nhật nếu hành vi người dùng thay đổi.

## Kịch bản kiểm thử

| Trường hợp | Input/Thao tác | Kết quả mong đợi |
|---|---|---|
| Luồng đúng |  |  |
| Dữ liệu không hợp lệ |  |  |
| Dependency/API lỗi |  |  |

## Kiểm tra bắt buộc

- [ ] `npm run test`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] Kiểm tra không có `.env`, token hoặc API key trong diff

## Phụ thuộc và rủi ro

Liên kết Issue/PR liên quan và mô tả điểm cần người còn lại phối hợp.


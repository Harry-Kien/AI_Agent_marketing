---
name: Báo lỗi
about: Ghi nhận lỗi có thể tái hiện trong Telegram, AI runtime hoặc Dashboard
title: "[BUG] "
labels: bug
assignees: ""
---

## Mô tả lỗi

Mô tả ngắn gọn hành vi sai và mức ảnh hưởng.

## Môi trường

- Commit/branch:
- Windows/Node version:
- Chế độ AI: 9Router thật hay fallback:
- Thành phần: Telegram / AI Provider / Domain / Dashboard:

Không dán token, `.env`, header Authorization hoặc ảnh chứa bí mật.

## Các bước tái hiện

1.
2.
3.

## Kết quả thực tế



## Kết quả mong đợi



## Bằng chứng đã làm sạch bí mật

- Log rút gọn:
- RUN_ID/TASK_ID/CAMPAIGN_ID nếu có:
- Ảnh/video đã che dữ liệu nhạy cảm:

## Phân tích ban đầu

- Owner đề xuất: OWNER-A / OWNER-B / Shared
- Tần suất: luôn xảy ra / thỉnh thoảng / một lần
- Mức độ: critical / high / medium / low
- Có workaround an toàn hay không:

## Điều kiện xác nhận đã sửa

- [ ] Có test tái hiện lỗi trước khi sửa.
- [ ] Test mới pass sau khi sửa.
- [ ] Không gây regression cho luồng liên quan.
- [ ] `npm run test`, `npm run typecheck`, `npm run build` pass.


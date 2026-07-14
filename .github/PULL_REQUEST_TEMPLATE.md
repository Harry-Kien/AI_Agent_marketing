## Tóm tắt

Mô tả ngắn gọn thay đổi và giá trị mang lại.

Closes #

## Owner và phạm vi

- Owner: OWNER-A / OWNER-B / Shared
- Branch nguồn:
- Nhánh đích: `dev`
- File/module chính:
- Nội dung cố ý không thực hiện:

## Hành vi trước và sau

| | Trước | Sau |
|---|---|---|
| Luồng chính |  |  |
| Khi dữ liệu/API lỗi |  |  |

## Hợp đồng dùng chung

- [ ] Không thay đổi shared contract.
- [ ] Có thay đổi shared contract và đã được cả OWNER-A, OWNER-B duyệt.

Nếu có thay đổi, ghi interface/payload, tương thích ngược và migration:

```text

```

## Bằng chứng kiểm thử

| Kiểm tra | Kết quả | Bằng chứng ngắn |
|---|---|---|
| `npm run test` | PASS/FAIL |  |
| `npm run typecheck` | PASS/FAIL |  |
| `npm run build` | PASS/FAIL |  |
| Telegram runtime hoặc browser | PASS/FAIL/N/A |  |

## Human-in-the-loop và bảo mật

- [ ] Không tự publish, chạy quảng cáo, deploy hoặc merge.
- [ ] Approval/reject vẫn kiểm tra đúng operator nếu liên quan.
- [ ] Không có `.env`, token, API key hoặc log nhạy cảm trong diff/ảnh.
- [ ] Dữ liệu mock/fallback được ghi nhãn rõ.

## Bằng chứng demo

Thêm transcript đã làm sạch bí mật, ảnh UI hoặc mô tả thao tác có thể tái hiện.

## Bàn giao cho reviewer

- Điều cần reviewer tập trung:
- Rủi ro còn lại:
- Việc tiếp theo:
- Link biên bản bàn giao/comment:

## Checklist reviewer

- [ ] PR đúng Issue và phạm vi owner.
- [ ] Contract tương thích hoặc có migration rõ ràng.
- [ ] Test kiểm tra cả luồng đúng và failure mode.
- [ ] Tài liệu khớp hành vi thực tế.
- [ ] Không có secret.
- [ ] Đủ điều kiện merge vào `dev`.


# Meta Production Readiness

## Đang sẵn sàng

- Xác thực Page bằng Graph API v23.0 ở chế độ đọc.
- Token được gửi qua Authorization header, không đặt trong URL hoặc log.
- Publication preview tách khỏi hành động publish.
- Publish bị khóa nếu thiếu feature flag, approval ID hoặc nội dung xác nhận không khớp.
- Customer-care policy mặc định chuyển tình huống nhạy cảm cho người quản lý.

## Bắt buộc hoàn tất trước production

1. Thu hồi/rotate Page access token và toàn bộ Telegram token từng xuất hiện trong ảnh hoặc chat.
2. Cung cấp Meta App ID, App Secret và Page access token dài hạn thuộc Business Portfolio chính thức.
3. Xin đúng quyền cần dùng, tối thiểu theo chức năng thực tế; không xin quyền rộng hơn.
4. Hoàn tất App Review/Business Verification nếu Meta yêu cầu cho tài khoản ngoài vai trò App.
5. Dựng HTTPS webhook public, verify token và kiểm tra chữ ký request bằng App Secret.
6. Lưu credential bằng secret manager, không dùng file `.env` trên server production.
7. Dùng PostgreSQL/queue cho idempotency, retry và audit đa tiến trình.
8. Thiết lập rate limit, alert, log retention và quy trình xử lý token hết hạn.
9. Viết FAQ được pháp chế/chủ doanh nghiệp duyệt trước khi cân nhắc bật auto-reply.
10. Chạy sandbox Page và checklist rollback trước khi bật `META_PUBLISH_ENABLED=true`.

## Chính sách không tự động

Không tự chạy quảng cáo, thay ngân sách, xóa bình luận, chặn tài khoản, trả lời khiếu nại, xử lý dữ liệu cá nhân hoặc đăng nội dung khác với preview đã xác nhận.

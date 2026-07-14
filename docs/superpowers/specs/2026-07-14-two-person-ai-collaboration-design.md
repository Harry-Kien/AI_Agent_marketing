# Thiết kế quy trình cộng tác 2 người và 2 AI

## Mục tiêu

Biến tài liệu phân công hiện tại thành nguồn sự thật chung để hai sinh viên, mỗi người sử dụng một AI hỗ trợ lập trình, có thể phát triển song song hệ thống AI Agent Marketing qua Telegram mà không chồng chéo phạm vi, không làm lộ bí mật và có thể kiểm thử tích hợp lặp lại.

## Phương án được chọn

Sử dụng một tài liệu vận hành trung tâm kết hợp với các biểu mẫu GitHub thực tế. Tài liệu trung tâm mô tả kiến trúc, quyền sở hữu file, hợp đồng dữ liệu, prompt khởi động, quy trình phiên làm việc, Definition of Done và kịch bản nghiệm thu. GitHub Issue, Pull Request và mẫu bàn giao bắt buộc hai luồng công việc tuân theo cùng một chuẩn.

## Thành phần

- `docs/PHAN_CONG_2_NGUOI_TELEGRAM_AGENT_MARKETING_KHOA_LUAN.md`: nguồn sự thật chính.
- `.github/ISSUE_TEMPLATE/feature.md`: mẫu giao một đơn vị công việc có thể kiểm thử.
- `.github/ISSUE_TEMPLATE/bug_report.md`: mẫu ghi nhận lỗi có bằng chứng tái hiện.
- `.github/PULL_REQUEST_TEMPLATE.md`: cổng kiểm soát chất lượng trước khi tích hợp.
- `docs/templates/AI_HANDOFF_TEMPLATE.md`: biên bản bàn giao giữa hai người và hai AI.
- `CONTRIBUTING.md`: quy tắc Git ngắn gọn dùng hằng ngày.

## Nguyên tắc

1. `dev` là nhánh tích hợp; `main` chỉ chứa bản demo ổn định.
2. Mỗi Issue tương ứng một branch và một Pull Request.
3. Người A sở hữu Telegram/AI runtime; người B sở hữu Dashboard/Data/Docs.
4. Thay đổi hợp đồng dùng chung phải được hai người duyệt trước khi code.
5. AI không được tự merge, tự phát hành, tự đăng nội dung hoặc đưa token vào Git.
6. Mọi Pull Request phải có bằng chứng `test`, `typecheck`, `build`.
7. Luồng end-to-end chỉ được coi là đạt khi Telegram, runtime state và dashboard cùng phản ánh một mã chiến dịch/task.

## Kiểm tra thiết kế

- Không có nội dung chờ quyết định hoặc placeholder nghiệp vụ.
- Phạm vi Telegram và Dashboard được tách rõ nhưng liên kết bằng hợp đồng dữ liệu.
- Có quy trình xử lý xung đột và thay đổi hợp đồng.
- Có tiêu chí nghiệm thu kỹ thuật và tiêu chí bảo vệ khóa luận.


# Enterprise Risk-Based Approval Design

## 1. Mục tiêu

Chuyển AI Marketing Command Center từ mô hình yêu cầu Admin duyệt sau mỗi Agent sang mô hình doanh nghiệp theo rủi ro. Các phòng ban AI tự bàn giao công việc nội bộ; Admin chỉ ra quyết định tại gói kết quả cuối và xác nhận xuất bản.

## 2. Phạm vi

- Áp dụng cho workflow campaign Telegram: Research, Content, Creative, Brand, Final và Publication.
- Không thay đổi danh tính sáu bot, Meta guard, 9Router provider hoặc dashboard read model.
- Giữ tương thích dữ liệu runtime hiện tại và giữ chế độ `strict-stage-gate` để kiểm thử hoặc trình bày cơ chế human-in-the-loop đầy đủ.
- Không tự chạy quảng cáo, chi tiền, xóa nội dung, xử lý khiếu nại nhạy cảm hoặc xuất bản nếu chưa có xác nhận cuối của Admin.

## 3. Chế độ phê duyệt

Biến môi trường `MARKETING_APPROVAL_MODE` có hai giá trị:

- `enterprise-risk-based`: mặc định. Research, Content, Creative và Brand tự bàn giao nếu đạt policy. Final Package chờ Admin duyệt. Publication Preview chờ Admin xác nhận riêng.
- `strict-stage-gate`: hành vi cũ. Mỗi stage đều chờ Admin duyệt.

Nếu biến môi trường không tồn tại, hệ thống dùng `enterprise-risk-based`.

## 4. Luồng chuẩn

```text
Admin giao mục tiêu
  -> Manager tạo campaign
  -> Market Radar tạo Research Package
  -> Policy Engine đánh giá và tự bàn giao
  -> Content Creator tạo Content Package
  -> Policy Engine đánh giá và tự bàn giao
  -> Content Strategy & Creative tạo Creative Package
  -> Policy Engine đánh giá và tự bàn giao
  -> Brand & Performance tạo Brand/KPI Package
  -> Policy Engine đánh giá và tự bàn giao
  -> Manager tạo Final Package
  -> Admin duyệt hoặc từ chối Final Package
  -> Page Growth tạo Publication Preview
  -> Admin xác nhận xuất bản
  -> Meta Graph xuất bản và lưu bằng chứng
```

## 5. Chính sách tự bàn giao

Một package được tự bàn giao khi đồng thời thỏa mãn:

- Output vượt qua Zod schema.
- `quality_score >= 80`.
- `recommendation` là `approve`.
- Có deliverables, checks và evidence.
- Không có tín hiệu rủi ro bắt buộc chuyển người quản lý.

Policy Engine xử lý:

| Điều kiện | Hành động |
|---|---|
| Điểm từ 80, recommendation `approve`, không có rủi ro nhạy cảm | Tự phê duyệt nội bộ và chạy stage kế tiếp |
| Điểm từ 70, recommendation `approve_with_conditions`, không có rủi ro nhạy cảm | Tự bàn giao có điều kiện để Brand/Manager xử lý trước Final |
| Điểm 60-79 hoặc recommendation `approve_with_conditions`/`revise` | Tự mở revision một lần với feedback từ quality gate |
| Sau revision vẫn chưa đạt nhưng không reject/rủi ro nhạy cảm | Bàn giao có điều kiện cho Brand/Manager và đưa cảnh báo vào Final |
| Recommendation `reject` hoặc có rủi ro bắt buộc | Dừng luồng và chuyển Admin |
| Final Package hoàn tất | Luôn chờ Admin duyệt |
| Publication Preview hoàn tất | Luôn chờ Admin xác nhận riêng |

## 6. Rủi ro bắt buộc chuyển Admin

- Claim tuyệt đối, cam kết doanh thu hoặc số liệu không có bằng chứng.
- Giá, chiết khấu, ngân sách quảng cáo hoặc hành động chi tiền.
- Pháp lý, bảo mật, dữ liệu cá nhân hoặc thông tin sức khỏe/tài chính.
- Khiếu nại, khủng hoảng, nội dung thù ghét hoặc tình huống có khả năng gây tổn hại thương hiệu.
- Thao tác xóa, chặn, xuất bản, chạy ads hoặc thay đổi tài sản thật.

## 7. Giao tiếp Telegram

- Mỗi Agent vẫn gửi một thông báo ngắn khi nhận và hoàn tất nhiệm vụ để người quản lý quan sát được.
- Thông báo nội bộ ghi rõ `AUTO-HANDOFF`, stage vừa hoàn tất, điểm chất lượng và Agent nhận tiếp theo.
- Không gửi câu hỏi `Duyệt?` ở Research, Content, Creative hoặc Brand khi policy cho phép tự bàn giao.
- Manager chỉ yêu cầu `Duyệt` cho Final Package hoặc khi workflow bị escalation.
- Admin tiếp tục dùng ngôn ngữ tự nhiên, không bắt buộc lệnh `/`.

## 8. Trạng thái và audit

- Mọi tự bàn giao tạo audit event với actor `policy-engine`.
- Audit phân biệt `auto_approved`, `human_approved`, `auto_revision_started` và `risk_escalated`.
- Mỗi hành động phải idempotent; restart không tạo run trùng.
- Dashboard hiển thị chế độ phê duyệt, stage hiện tại, điểm chất lượng và lý do escalation.

## 9. Xử lý lỗi

- Lỗi 9Router hoặc output sai schema dùng fallback có nhãn; fallback không được tự phê duyệt.
- Agent timeout được retry theo provider policy; hết retry thì escalation.
- Lỗi lưu runtime không được chuyển stage.
- Meta lỗi không làm campaign mất trạng thái Final Approved; publication giữ ở trạng thái có thể thử lại.

## 10. Kiểm thử chấp nhận

1. Campaign thông thường tự chạy Research -> Content -> Creative -> Brand -> Final mà không cần Admin duyệt trung gian.
2. Admin chỉ thấy một yêu cầu duyệt Final Package và một xác nhận Publication Preview.
3. Output điểm dưới 80 tự revision tối đa một lần.
4. Output recommendation `reject` hoặc chứa rủi ro nhạy cảm dừng và yêu cầu Admin.
5. `strict-stage-gate` vẫn yêu cầu duyệt từng stage.
6. Restart giữa auto-handoff không tạo run hoặc audit event trùng.
7. Telegram 6/6, Meta guard, typecheck, build, unit tests và browser smoke tiếp tục đạt.

## 11. Ngoài phạm vi

- Tự chạy quảng cáo hoặc chi ngân sách.
- Tự trả lời tình huống CSKH nhạy cảm.
- Bỏ xác nhận xuất bản.
- Thay local state bằng durable workflow engine trong thay đổi này.

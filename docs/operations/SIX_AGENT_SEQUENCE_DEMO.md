# Kịch bản kiểm thử Sequence Diagram - Phòng Marketing AI

## 1. Sequence chuẩn

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Chủ doanh nghiệp
    participant TG as Telegram Group
    participant M as Marketing Manager
    participant R as Market Intelligence
    participant C as Content Creator
    participant P as Content Strategy & Creative
    participant B as Brand & Performance
    participant G as Page Growth & Community
    participant AI as 9Router / LLM
    participant DB as Runtime State + Audit
    participant FB as Meta Graph API

    Admin->>TG: Chat mục tiêu chiến dịch
    TG->>M: Chuyển tin đã xác thực group/operator
    M->>DB: Tạo Campaign + Research Run
    M->>R: Giao brief nghiên cứu
    R->>AI: Yêu cầu insight theo vai trò
    AI-->>R: Research Package
    R->>DB: Lưu output + quality score
    DB->>DB: Policy Engine kiểm tra rủi ro
    DB-->>R: AUTO-HANDOFF nếu đạt policy
    R->>C: Bàn giao Research Package
    C->>AI: Tạo Content Package
    AI-->>C: Hook, copy, CTA
    C->>DB: Lưu output + policy decision
    C->>P: AUTO-HANDOFF Content Package
    P->>AI: Tạo Creative Package
    P->>DB: Lưu visual brief + storyboard
    P->>B: AUTO-HANDOFF Creative Package
    B->>AI: Review brand, claim, CTA, KPI
    B->>DB: Lưu Quality Gate
    B->>M: AUTO-HANDOFF Brand Package
    M->>AI: Tổng hợp Final Package
    M-->>Admin: Final Package chờ duyệt
    Admin->>M: Duyệt Final
    M->>DB: ready_to_schedule
    Admin->>M: Chuẩn bị đăng
    M->>G: Tạo lịch và publication preview
    G-->>Admin: Bản xem trước chính xác
    Admin->>M: Xác nhận đăng lần cuối
    M->>DB: Kiểm tra approval evidence + feature flag
    M->>FB: Publish nội dung đã xác nhận
    FB-->>M: Post ID + permalink
    M->>DB: Lưu bằng chứng published
    G->>FB: Đọc metrics
    G-->>Admin: Báo cáo và đề xuất tối ưu

    opt Package nội bộ không đạt policy
        DB->>DB: Auto-revision tối đa một lần
        DB-->>Admin: Escalate nếu vẫn lỗi hoặc có rủi ro nhạy cảm
    end
```

## 2. Ví dụ test bằng chat tự nhiên

Gửi cho `@kien_mkt_manager_bot` trong group đã cấu hình:

```text
Hãy tạo chiến dịch giới thiệu giải pháp AI Agent cho doanh nghiệp SME trên Facebook. Khách hàng là chủ doanh nghiệp 5-50 nhân sự, mục tiêu là đặt lịch tư vấn, giọng điệu thực tế và không phóng đại.
```

Kết quả mong đợi:

1. Manager tạo `CMP-...` và `RUN-...-RSH-1`.
2. Market Intelligence trả Research Package và thông báo `AUTO-HANDOFF`.
3. Content Creator, Content Strategy & Creative và Brand & Performance tự chạy nối tiếp khi đạt policy.
4. Manager chỉ dừng ở Final Package để chờ Admin duyệt.

Khi Final Package xuất hiện, chat:

```text
Có gì đang chờ tôi duyệt?
Duyệt
```

Không cần duyệt Research, Content, Creative hoặc Brand. Nếu một package có điểm thấp, Policy Engine tự revision một lần; điều kiện chưa giải quyết sẽ được chuyển cho Brand/Manager và đưa vào Final. Chỉ recommendation `reject`, lỗi provider hoặc rủi ro nhạy cảm mới dừng luồng. Cuối luồng:

```text
Tình hình chiến dịch thế nào?
Chuẩn bị đăng CMP-<ID vừa tạo>
Xác nhận đăng CMP-<ID vừa tạo>
```

Ở cấu hình production có kiểm soát, Page Growth phải hiển thị đúng `publication_content` trong Final Package. Chỉ sau câu xác nhận cuối của Operator, Meta Graph mới được gọi; kết quả thành công phải trả về `postId` làm bằng chứng. Nếu feature flag tắt hoặc credential không hợp lệ, hệ thống phải dừng và không thay đổi trạng thái thành `published`.

Nếu Meta lỗi sau bước xác nhận, campaign chuyển sang `failed`, ghi `publication_failed` vào Audit và không tự retry để tránh đăng trùng. Operator phải đối soát Fanpage trước khi tạo lần xuất bản tiếp theo.

## 3. Tiêu chí đạt

- Mỗi stage chỉ bắt đầu sau khi policy decision của stage trước đã lưu thành công.
- Mỗi output có Campaign ID, Run ID, vai trò, trạng thái và audit event.
- `Duyệt` mơ hồ không làm thay đổi dữ liệu.
- Auto-revision và reject đều giữ lý do cùng liên kết với run cũ.
- Nội dung Final không đồng nghĩa đã đăng.
- Publish cần hai bằng chứng: Final đã duyệt và xác nhận đúng preview.
- Meta lỗi không được làm mất workflow; lỗi phải được làm sạch, không lộ token.
- Dashboard hiển thị cùng campaign/stage/audit với runtime local.

# Two-Person AI Collaboration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thiện bộ tài liệu vận hành để hai người và hai AI phát triển, review, tích hợp và kiểm thử hệ thống Telegram Agent Marketing theo cùng một quy trình.

**Architecture:** Một tài liệu trung tâm giữ toàn bộ kiến trúc và quy tắc vận hành; các template GitHub biến quy tắc thành cổng kiểm soát trong công việc hằng ngày. Telegram runtime và Dashboard phát triển độc lập, giao tiếp qua hợp đồng dữ liệu được version hóa.

**Tech Stack:** Markdown, Git, GitHub Issues, GitHub Pull Requests, npm scripts, Vitest, TypeScript, Vite.

## Global Constraints

- Không tích hợp Lark trong phạm vi MVP.
- Không commit `.env` hoặc token thật.
- Không tự động đăng bài, chạy quảng cáo, merge hoặc deploy.
- Mọi hành động phát hành phải có người quản lý phê duyệt.
- Các lệnh bắt buộc trước Pull Request: `npm run test`, `npm run typecheck`, `npm run build`.

---

### Task 1: Nâng cấp tài liệu nguồn sự thật

**Files:**
- Modify: `docs/PHAN_CONG_2_NGUOI_TELEGRAM_AGENT_MARKETING_KHOA_LUAN.md`

**Interfaces:**
- Consumes: cấu trúc hệ thống và phân công hiện tại.
- Produces: prompt, workflow, contract, Definition of Done và test matrix cho hai AI.

- [x] Bổ sung quy tắc nguồn sự thật và quyền sở hữu file.
- [x] Bổ sung prompt khởi động dùng chung và prompt riêng cho hai vai trò.
- [x] Bổ sung quy trình bắt đầu, thực hiện, bàn giao và kết thúc một phiên làm việc.
- [x] Bổ sung hợp đồng dữ liệu và quy trình thay đổi hợp đồng.
- [x] Bổ sung ma trận kiểm thử, Definition of Done và kịch bản nghiệm thu.
- [x] Rà soát không còn hướng dẫn mơ hồ hoặc mâu thuẫn.

### Task 2: Tạo cổng chất lượng GitHub

**Files:**
- Create: `.github/ISSUE_TEMPLATE/feature.md`
- Create: `.github/ISSUE_TEMPLATE/bug_report.md`
- Create: `.github/PULL_REQUEST_TEMPLATE.md`

**Interfaces:**
- Consumes: quy tắc branch, commit và kiểm thử trong tài liệu trung tâm.
- Produces: Issue và Pull Request có đủ phạm vi, acceptance criteria, bằng chứng test và bảo mật.

- [x] Tạo mẫu Issue tính năng có owner, phạm vi file, tiêu chí nghiệm thu và test.
- [x] Tạo mẫu báo lỗi có bước tái hiện, expected/actual và bằng chứng.
- [x] Tạo mẫu Pull Request có liên kết Issue, checklist chất lượng và review chéo.
- [x] Kiểm tra template không yêu cầu đưa bí mật vào nội dung công khai.

### Task 3: Tạo mẫu bàn giao và hướng dẫn đóng góp

**Files:**
- Create: `docs/templates/AI_HANDOFF_TEMPLATE.md`
- Create: `CONTRIBUTING.md`

**Interfaces:**
- Consumes: kết quả của một phiên làm việc trên feature branch.
- Produces: thông tin tối thiểu để người và AI còn lại tiếp tục mà không cần đoán.

- [x] Tạo mẫu bàn giao gồm mục tiêu, thay đổi, contract, test, rủi ro và bước tiếp theo.
- [x] Tạo hướng dẫn Git hằng ngày ngắn gọn cho hai người.
- [x] Liên kết các biểu mẫu từ tài liệu trung tâm.

### Task 4: Xác minh bộ tài liệu

**Files:**
- Verify: toàn bộ file ở Task 1-3.

**Interfaces:**
- Consumes: bộ tài liệu hoàn chỉnh.
- Produces: bằng chứng không có placeholder và các đường dẫn tham chiếu tồn tại.

- [x] Rà soát dấu giữ chỗ, token thật và hướng dẫn ngoài phạm vi Telegram-first.
- [x] Kiểm tra mọi đường dẫn file được nhắc đến đều đúng với workspace.
- [x] Chạy test, typecheck và build để xác nhận tài liệu không ảnh hưởng ứng dụng.
- [x] Ghi kết quả xác minh vào phần báo cáo cuối.

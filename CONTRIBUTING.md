# Hướng dẫn cộng tác dự án

Tài liệu nguồn sự thật: `README.md`, `docs/operations/SIX_AGENT_SEQUENCE_DEMO.md` và `docs/operations/PRODUCTION_READINESS_AUDIT.md`.

## Quy trình ngắn gọn

1. Chọn một Issue đã đạt Definition of Ready.
2. Đồng bộ `dev` và tạo branch `feature/issue-<id>-<ten-ngan>` hoặc `fix/issue-<id>-<ten-ngan>`.
3. Gửi tài liệu nguồn sự thật, Issue và prompt đúng owner cho AI.
4. Chỉ sửa file trong phạm vi Issue; shared contract cần hai người duyệt.
5. Chạy `npm run test`, `npm run typecheck`, `npm run build` và kiểm tra diff.
6. Commit theo Conventional Commits.
7. Push feature branch và tạo Pull Request vào `dev`.
8. Điền đầy đủ PR template và biên bản bàn giao.
9. Người còn lại review; tác giả không tự merge.
10. Chỉ merge `dev` vào `main` tại mốc demo ổn định.

## Quy tắc branch

```text
feature/issue-12-telegram-approval-flow
fix/issue-18-ai-timeout
test/issue-21-campaign-e2e
docs/issue-24-sequence-diagram
```

## Quy tắc commit

```text
feat(telegram): add operator approval gate
feat(dashboard): add approval queue
fix(ai): handle provider timeout
test(domain): cover rejected campaign transition
docs(thesis): add end-to-end evidence matrix
```

## Bảo mật

- Không commit `.env`, token hoặc API key.
- Không dán secret vào Issue, Pull Request, log hoặc screenshot.
- Nếu secret bị lộ, thu hồi và tạo lại ngay.
- AI không được tự merge, publish hoặc deploy.

## Kiểm tra bắt buộc

```bash
npm run test
npm run typecheck
npm run build
npm run smoke
git diff --check
```

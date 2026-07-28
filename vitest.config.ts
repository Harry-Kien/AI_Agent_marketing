import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // forks + chạy tuần tự (Vitest 4): ổn định trên Windows, tránh lỗi cold-start "no tests".
    pool: "forks",
    fileParallelism: false,
    isolate: true
  }
});

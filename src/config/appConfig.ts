import { z } from "zod";

// Cấu hình hạ tầng cho bản self-hosted single-tenant. Kiểm định fail-fast để không chạy sai âm thầm.
export const logLevels = ["debug", "info", "warn", "error"] as const;
export type LogLevel = (typeof logLevels)[number];

const rawSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.enum(logLevels).default("info"),
  CONTROL_API_HOST: z.string().trim().min(1).default("127.0.0.1"),
  CONTROL_API_PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  // Token bảo vệ write-path. Tối thiểu 16 ký tự để không đặt token yếu.
  CONTROL_API_TOKEN: z.string().trim().min(16).optional(),
  CONTROL_API_ALLOW_ORIGIN: z.string().trim().url().optional(),
  TELEGRAM_RUNTIME_STATE_PATH: z.string().trim().min(1).default("output/telegram-runtime-state.json")
});

export interface AppConfig {
  nodeEnv: "development" | "production" | "test";
  logLevel: LogLevel;
  controlApi: {
    host: string;
    port: number;
    token?: string;
    allowOrigin?: string;
  };
  statePath: string;
  warnings: string[];
}

export function loadAppConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const parsed = rawSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`).join("\n");
    throw new Error(`Cấu hình môi trường không hợp lệ:\n${issues}`);
  }
  const c = parsed.data;
  const warnings: string[] = [];
  if (c.NODE_ENV === "production" && !c.CONTROL_API_TOKEN) {
    warnings.push("CONTROL_API_TOKEN chưa đặt trong production — write-path đang KHÔNG được bảo vệ, ai truy cập cũng có thể tạo/duyệt chiến dịch.");
  }
  if (c.NODE_ENV === "production" && c.CONTROL_API_HOST === "127.0.0.1") {
    warnings.push("CONTROL_API_HOST=127.0.0.1 chỉ nhận kết nối cục bộ; đặt 0.0.0.0 nếu cần truy cập từ máy khác (nhớ bật token + tường lửa).");
  }
  return {
    nodeEnv: c.NODE_ENV,
    logLevel: c.LOG_LEVEL,
    controlApi: {
      host: c.CONTROL_API_HOST,
      port: c.CONTROL_API_PORT,
      token: c.CONTROL_API_TOKEN,
      allowOrigin: c.CONTROL_API_ALLOW_ORIGIN
    },
    statePath: c.TELEGRAM_RUNTIME_STATE_PATH,
    warnings
  };
}

const secretKeyPattern = /(token|key|secret|password|authorization|apikey)/i;

// Che giá trị của mọi trường nhạy cảm trước khi log/hiển thị.
export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, val]) =>
        secretKeyPattern.test(key) && val ? [key, "[đã ẩn]"] : [key, redactSecrets(val)]
      )
    );
  }
  return value;
}

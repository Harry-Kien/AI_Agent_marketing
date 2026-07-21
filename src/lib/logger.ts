import { logLevels, redactSecrets, type LogLevel } from "../config/appConfig";

const levelRank: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export interface Logger {
  debug: (message: string, context?: Record<string, unknown>) => void;
  info: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
  error: (message: string, context?: Record<string, unknown>) => void;
}

export interface LoggerOptions {
  level?: LogLevel;
  service?: string;
  sink?: (line: string) => void;
  now?: () => string;
}

// Logger JSON một dòng, có mức, timestamp và tự che secret/PII trong context.
export function createLogger(options: LoggerOptions = {}): Logger {
  const level = options.level ?? "info";
  const sink = options.sink ?? ((line: string) => process.stdout.write(`${line}\n`));
  const now = options.now ?? (() => new Date().toISOString());
  const service = options.service ?? "app";

  function emit(entryLevel: LogLevel, message: string, context?: Record<string, unknown>) {
    if (levelRank[entryLevel] < levelRank[level]) return;
    const payload: Record<string, unknown> = {
      time: now(),
      level: entryLevel,
      service,
      message
    };
    if (context) payload.context = redactSecrets(context);
    sink(JSON.stringify(payload));
  }

  return {
    debug: (message, context) => emit("debug", message, context),
    info: (message, context) => emit("info", message, context),
    warn: (message, context) => emit("warn", message, context),
    error: (message, context) => emit("error", message, context)
  };
}

export { logLevels };

// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createLogger } from "../src/lib/logger";

function capture(level: "debug" | "info" | "warn" | "error" = "info") {
  const lines: string[] = [];
  const log = createLogger({ level, service: "test", sink: (line) => lines.push(line), now: () => "2026-07-22T00:00:00.000Z" });
  return { log, lines };
}

describe("createLogger", () => {
  it("xuất JSON một dòng có time/level/service/message", () => {
    const { log, lines } = capture();
    log.info("hello", { a: 1 });
    const entry = JSON.parse(lines[0]);
    expect(entry).toMatchObject({ level: "info", service: "test", message: "hello", time: "2026-07-22T00:00:00.000Z" });
    expect(entry.context).toEqual({ a: 1 });
  });

  it("lọc theo mức: debug bị bỏ khi level=info", () => {
    const { log, lines } = capture("info");
    log.debug("skip");
    log.warn("keep");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]).message).toBe("keep");
  });

  it("che secret trong context", () => {
    const { log, lines } = capture();
    log.info("action", { token: "SECRET", user: "kien" });
    const entry = JSON.parse(lines[0]);
    expect(entry.context.token).toBe("[đã ẩn]");
    expect(entry.context.user).toBe("kien");
  });
});

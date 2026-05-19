// Simple structured logger — no external dependencies, no worker threads
// Drop-in replacement for pino: supports .info(), .warn(), .error(), .debug()

type Level = "debug" | "info" | "warn" | "error";
type LogData = Record<string, unknown> | unknown;

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const currentLevel: Level = (process.env.LOG_LEVEL as Level) ?? "info";
const minLevel = LEVELS[currentLevel] ?? 20;

function write(level: Level, data: LogData, msg?: string): void {
  if (LEVELS[level] < minLevel) return;
  const entry = {
    time: Date.now(),
    level,
    ...(typeof data === "object" && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : { data }),
    ...(msg ? { msg } : {}),
  };
  const line = JSON.stringify(entry);
  if (level === "error" || level === "warn") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

export const logger = {
  debug: (data: LogData, msg?: string) => write("debug", data, msg),
  info:  (data: LogData, msg?: string) => write("info",  data, msg),
  warn:  (data: LogData, msg?: string) => write("warn",  data, msg),
  error: (data: LogData, msg?: string) => write("error", data, msg),
};

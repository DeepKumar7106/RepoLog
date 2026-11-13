import { env } from "@/lib/validation/env";

type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace";
type OutputLevel = "debug" | "info" | "warn" | "error";

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  fatal: 50,
  error: 40,
  warn: 30,
  info: 20,
  debug: 10,
  trace: 0,
};

function write(level: OutputLevel, event: string, fields: Record<string, unknown>) {
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[env.LOG_LEVEL]) {
    return;
  }

  const entry = JSON.stringify({
    level,
    event,
    timestamp: new Date().toISOString(),
    ...fields,
  });

  if (level === "error") {
    console.error(entry);
  } else if (level === "warn") {
    console.warn(entry);
  } else {
    console.log(entry);
  }
}

export function logInfo(event: string, fields: Record<string, unknown> = {}) {
  write("info", event, fields);
}

export function logWarn(event: string, fields: Record<string, unknown> = {}) {
  write("warn", event, fields);
}

export function logError(event: string, fields: Record<string, unknown> = {}) {
  write("error", event, fields);
}

// Program 2 · Phase 2.1 (D9) — thin structured logger.
//
// Enhancement-only: a minimal, dependency-free wrapper over console that adds a
// consistent timestamp + level + optional scope prefix and a structured-meta
// trailer. It does NOT replace console globally and does NOT change behavior of
// any existing call site — it is adopted incrementally ("on touch"), so the
// flag-off / pre-existing paths stay byte-identical.
//
// Usage:
//   import { logger } from "./lib/logger";
//   logger.info("user logged out", { userId });
//   const log = logger.scope("auth");  log.warn("otp send failed", { err });

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

// LOG_LEVEL env overrides the floor; defaults to debug in dev, info in prod.
function minLevel(): number {
  const env = String(process.env.LOG_LEVEL || "").toLowerCase() as LogLevel;
  if (env in LEVELS) return LEVELS[env];
  return process.env.NODE_ENV === "production" ? LEVELS.info : LEVELS.debug;
}

function fmtMeta(meta?: unknown): string {
  if (meta === undefined || meta === null) return "";
  if (meta instanceof Error) return ` ${meta.name}: ${meta.message}`;
  try {
    if (typeof meta === "object") return ` ${JSON.stringify(meta)}`;
    return ` ${String(meta)}`;
  } catch {
    return " [unserializable-meta]";
  }
}

function emit(level: LogLevel, scope: string | null, msg: string, meta?: unknown): void {
  if (LEVELS[level] < minLevel()) return;
  const ts = new Date().toISOString();
  const prefix = scope ? `[${level.toUpperCase()}] [${scope}]` : `[${level.toUpperCase()}]`;
  const line = `${ts} ${prefix} ${msg}${fmtMeta(meta)}`;
  // Route to the matching console method so existing log drains keep working.
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export interface Logger {
  debug(msg: string, meta?: unknown): void;
  info(msg: string, meta?: unknown): void;
  warn(msg: string, meta?: unknown): void;
  error(msg: string, meta?: unknown): void;
  scope(name: string): Logger;
}

function make(scope: string | null): Logger {
  return {
    debug: (m, meta) => emit("debug", scope, m, meta),
    info: (m, meta) => emit("info", scope, m, meta),
    warn: (m, meta) => emit("warn", scope, m, meta),
    error: (m, meta) => emit("error", scope, m, meta),
    scope: (name) => make(scope ? `${scope}:${name}` : name),
  };
}

export const logger: Logger = make(null);

/**
 * ALCHEMI Structured Logger
 *
 * Provides a unified, level-based logging interface for the frontend.
 * In development: logs to the console with structured context objects.
 * In production:  silences debug/info logs; errors are forwarded to a
 *                 remote telemetry endpoint when one is configured.
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info("transform", "Code migration started", { projectId, stepId });
 *   logger.error("auth", "Login failed", { username }, err);
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  ts: string;          // ISO-8601 timestamp
  level: LogLevel;
  module: string;      // Logical domain — e.g. "auth", "transform", "llm"
  message: string;
  context?: Record<string, unknown>;
  error?: string;      // Serialised error message
  stack?: string;      // Serialised stack trace
  correlationId?: string;
}

const isDev = typeof import.meta !== "undefined" && (import.meta as any).env?.DEV !== undefined
  ? Boolean((import.meta as any).env.DEV)
  : process.env.NODE_ENV !== "production";

let _correlationId: string | null = null;

/** Set a per-request/session correlation ID (e.g. after login). */
export function setCorrelationId(id: string | null): void {
  _correlationId = id;
}

function buildEntry(
  level: LogLevel,
  module: string,
  message: string,
  context?: Record<string, unknown>,
  err?: unknown
): LogEntry {
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    module,
    message,
    ...(context && Object.keys(context).length > 0 ? { context } : {}),
    ...(_correlationId ? { correlationId: _correlationId } : {}),
  };

  if (err instanceof Error) {
    entry.error = err.message;
    if (err.stack) entry.stack = err.stack;
  } else if (err !== undefined) {
    entry.error = String(err);
  }

  return entry;
}

// ─── Console transport ───────────────────────────────────────────────────────

const LEVEL_STYLES: Record<LogLevel, string> = {
  debug: "color: #94a3b8; font-weight: 400",
  info:  "color: #60a5fa; font-weight: 500",
  warn:  "color: #f59e0b; font-weight: 600",
  error: "color: #f87171; font-weight: 700",
};

function consoleTransport(entry: LogEntry): void {
  const prefix = `[${entry.ts}] [${entry.module.toUpperCase()}]`;
  const style  = LEVEL_STYLES[entry.level];

  const args: unknown[] = [`%c${prefix} ${entry.message}`, style];
  if (entry.context) args.push(entry.context);
  if (entry.error)   args.push({ error: entry.error, stack: entry.stack });
  if (entry.correlationId) args.push({ correlationId: entry.correlationId });

  switch (entry.level) {
    case "debug": console.debug(...args); break;
    case "info":  console.info(...args);  break;
    case "warn":  console.warn(...args);  break;
    case "error": console.error(...args); break;
  }
}

const REMOTE_ENDPOINT = typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_LOG_ENDPOINT
  ? ((import.meta as any).env.VITE_LOG_ENDPOINT as string)
  : (process.env.VITE_LOG_ENDPOINT as string | undefined);

function remoteTransport(entry: LogEntry): void {
  if (!REMOTE_ENDPOINT || typeof navigator === "undefined" || !navigator.sendBeacon) return;
  // Fire-and-forget — never block the call-site
  navigator.sendBeacon(
    REMOTE_ENDPOINT,
    new Blob([JSON.stringify(entry)], { type: "application/json" })
  );
}

// ─── Core emit ───────────────────────────────────────────────────────────────

function emit(
  level: LogLevel,
  module: string,
  message: string,
  context?: Record<string, unknown>,
  err?: unknown
): void {
  const entry = buildEntry(level, module, message, context, err);

  // Always log to console in dev; in prod only warn/error
  if (isDev || level === "warn" || level === "error") {
    consoleTransport(entry);
  }

  // Forward errors (and optionally warnings) to remote telemetry in production
  if (!isDev && (level === "error" || level === "warn")) {
    remoteTransport(entry);
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export const logger = {
  debug: (module: string, message: string, context?: Record<string, unknown>) =>
    emit("debug", module, message, context),

  info: (module: string, message: string, context?: Record<string, unknown>) =>
    emit("info", module, message, context),

  warn: (module: string, message: string, context?: Record<string, unknown>, err?: unknown) =>
    emit("warn", module, message, context, err),

  error: (module: string, message: string, context?: Record<string, unknown>, err?: unknown) =>
    emit("error", module, message, context, err),
} as const;

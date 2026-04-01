/**
 * Structured JSON logger for edge function handlers.
 *
 * Emits one JSON line per call so logs are machine-parseable in any
 * aggregator (Datadog, CloudWatch, Vercel Log Drains, etc.).
 *
 * debug lines are suppressed in production — use for verbose diagnostics only.
 */

const IS_PROD = process.env.NODE_ENV === 'production';

type Level = 'debug' | 'info' | 'warn' | 'error';

function emit(level: Level, event: string, data?: Record<string, unknown>): void {
  if (level === 'debug' && IS_PROD) return;
  const entry = JSON.stringify({ level, event, ts: new Date().toISOString(), ...data });
  if (level === 'error') console.error(entry);
  else if (level === 'warn') console.warn(entry);
  else console.log(entry);
}

export const logger = {
  debug: (event: string, data?: Record<string, unknown>) => emit('debug', event, data),
  info:  (event: string, data?: Record<string, unknown>) => emit('info',  event, data),
  warn:  (event: string, data?: Record<string, unknown>) => emit('warn',  event, data),
  error: (event: string, data?: Record<string, unknown>) => emit('error', event, data),
};

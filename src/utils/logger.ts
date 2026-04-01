/**
 * Structured JSON logger for client-side code.
 *
 * debug/info are silenced in production builds — safe to leave in place.
 * warn/error always fire so real issues are visible in the browser console.
 *
 * To enable production error tracking, replace the body of reportError with:
 *   Sentry.captureException(err, { extra: context });
 * after adding @sentry/react to the project.
 */

const IS_DEV = import.meta.env.DEV;

type Level = 'debug' | 'info' | 'warn' | 'error';

function emit(level: Level, event: string, data?: Record<string, unknown>): void {
  if ((level === 'debug' || level === 'info') && !IS_DEV) return;
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

/**
 * Report an unexpected error. Replace the body with your error tracker
 * (e.g. Sentry.captureException) when you're ready for production monitoring.
 */
export function reportError(err: unknown, context?: Record<string, unknown>): void {
  emit('error', 'reported_error', {
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    ...context,
  });
}

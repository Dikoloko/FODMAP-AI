import { useRef, useEffect, useCallback } from 'react';

const DEFAULT_TIMEOUT_MS = 35_000;

/**
 * Returns a `begin()` function that:
 * - aborts any in-flight request from a previous call
 * - creates a new AbortController and sets a timeout
 * - returns `{ signal, cleanup }` — call `cleanup()` in finally to clear the timer
 *
 * Automatically aborts on component unmount.
 */
export function useAbortController(timeoutMs = DEFAULT_TIMEOUT_MS) {
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  return useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const id = setTimeout(() => controller.abort(), timeoutMs);
    return {
      signal: controller.signal,
      cleanup: () => clearTimeout(id),
    };
  }, [timeoutMs]);
}

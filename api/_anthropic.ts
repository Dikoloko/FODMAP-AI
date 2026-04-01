/**
 * Shared Anthropic API client with retry logic and rate-limit handling.
 */
import { logger } from './_logger';

export const ANTHROPIC_API_URL =
  process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1/messages';

export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

interface AnthropicRequestBody {
  model: string;
  max_tokens: number;
  system: string;
  messages: Array<{ role: string; content: unknown }>;
}

interface CallOptions {
  body: Omit<AnthropicRequestBody, 'model'> & { model?: string };
  apiKey: string;
  /** Timeout in ms (default 30 000) */
  timeout?: number;
  /** Max retries on transient errors (default 2) */
  maxRetries?: number;
  /** AbortSignal from the incoming request (so client disconnects propagate) */
  signal?: AbortSignal;
  /** Request ID for log correlation */
  requestId?: string;
}

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503]);

/**
 * Call the Anthropic messages API with:
 * - Configurable timeout (default 30 s)
 * - Automatic retry with exponential back-off for 429 / 5xx
 * - Respect for Retry-After header on 429
 *
 * Returns the Response on success, or throws an object with
 * `{ status, message }` that callers can forward to the client.
 */
export async function callAnthropic(opts: CallOptions): Promise<Response> {
  const {
    body,
    apiKey,
    timeout = 30_000,
    maxRetries = 2,
    signal: incomingSignal,
    requestId,
  } = opts;

  const requestBody = JSON.stringify({
    ...body,
    model: body.model ?? ANTHROPIC_MODEL,
  });

  let lastResponse: Response | undefined;
  const t0 = Date.now();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Create a per-attempt abort controller that also listens to the incoming signal
    const abort = new AbortController();
    const timeoutId = setTimeout(() => abort.abort(), timeout);

    // If the original request was cancelled, propagate immediately
    const onIncomingAbort = () => abort.abort();
    incomingSignal?.addEventListener('abort', onIncomingAbort, { once: true });

    logger.debug('anthropic_attempt', { requestId, attempt });

    try {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: requestBody,
        signal: abort.signal,
      });

      if (response.ok) {
        logger.info('anthropic_complete', { requestId, attempt, durationMs: Date.now() - t0 });
        return response;
      }

      lastResponse = response;

      // Capture error body before deciding whether to retry
      const errBody = await response.clone().text().catch(() => '');

      // Only retry on transient errors and if we have attempts left
      if (!RETRYABLE_STATUSES.has(response.status) || attempt === maxRetries) {
        logger.error('anthropic_api_error', {
          requestId,
          attempt,
          status: response.status,
          errBody,
          durationMs: Date.now() - t0,
        });
        break;
      }

      logger.warn('anthropic_retry', { requestId, attempt, status: response.status });

      // Determine back-off delay
      let delay: number;
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        delay = retryAfter ? Math.min(Number(retryAfter) * 1000, 30_000) : 2000 * 2 ** attempt;
      } else {
        delay = 1000 * 2 ** attempt; // 1s, 2s
      }

      await new Promise(r => setTimeout(r, delay));
    } catch (fetchErr) {
      if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
        // Check if it was the incoming signal (client disconnect) vs our timeout
        if (incomingSignal?.aborted) {
          logger.info('anthropic_client_disconnect', { requestId, attempt, durationMs: Date.now() - t0 });
          throw { status: 499, message: 'Client disconnected' };
        }
        logger.warn('anthropic_timeout', { requestId, attempt, durationMs: Date.now() - t0 });
        throw { status: 504, message: 'Request timed out' };
      }
      // Network error — retry if attempts remain
      if (attempt === maxRetries) {
        logger.error('anthropic_network_error', {
          requestId,
          attempt,
          message: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
          durationMs: Date.now() - t0,
        });
        throw { status: 502, message: 'Failed to reach AI service' };
      }
      logger.warn('anthropic_network_retry', {
        requestId,
        attempt,
        message: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
      });
      await new Promise(r => setTimeout(r, 1000 * 2 ** attempt));
    } finally {
      clearTimeout(timeoutId);
      incomingSignal?.removeEventListener('abort', onIncomingAbort);
    }
  }

  // Exhausted retries — return appropriate error
  const status = lastResponse?.status ?? 500;
  if (status === 429) {
    const retryAfter = lastResponse?.headers.get('retry-after');
    const wait = retryAfter ? `${retryAfter} seconds` : 'a moment';
    throw { status: 429, message: `Rate limited — please wait ${wait} and try again` };
  }
  throw { status, message: `AI service error (${status})` };
}

import { ConnectorError, type FetchJson } from './types';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(baseMs: number): number {
  const spread = baseMs * 0.3;
  return Math.round(baseMs - spread + Math.random() * spread * 2);
}

export const defaultFetchJson: FetchJson = async (url, init) => {
  const res = await fetch(url, init);
  let json: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      throw new ConnectorError('parse_error', `Non-JSON response from ${url}`, {
        status: res.status,
        retryable: false,
      });
    }
  }
  return {
    status: res.status,
    headers: res.headers,
    json,
    ok: res.ok,
  };
};

export async function fetchJsonWithRetry(
  fetchJson: FetchJson,
  url: string,
  init: RequestInit | undefined,
  opts?: { attempts?: number; baseDelayMs?: number },
): Promise<{ status: number; headers: Headers; json: unknown; ok: boolean }> {
  const attempts = opts?.attempts ?? 3;
  const baseDelayMs = opts?.baseDelayMs ?? 400;
  let lastError: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      const result = await fetchJson(url, init);
      if (result.status === 429 || result.status >= 500) {
        throw new ConnectorError(
          'http_error',
          `Upstream HTTP ${result.status} for ${url}`,
          { status: result.status, retryable: true },
        );
      }
      return result;
    } catch (err) {
      lastError = err;
      if (init?.signal?.aborted) {
        throw new ConnectorError('cancelled', 'Request cancelled', {
          retryable: false,
          cause: err,
        });
      }
      const retryable =
        err instanceof ConnectorError
          ? err.retryable
          : true;
      if (!retryable || i === attempts - 1) {
        if (err instanceof ConnectorError) throw err;
        throw new ConnectorError(
          'timeout',
          err instanceof Error ? err.message : 'Request failed',
          { retryable: false, cause: err },
        );
      }
      await sleep(jitter(baseDelayMs * 2 ** i));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new ConnectorError('unavailable', 'Request failed');
}

export function parseLinkNext(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const parts = linkHeader.split(',');
  for (const part of parts) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="?next"?/i);
    if (match?.[1]) return match[1];
  }
  return null;
}

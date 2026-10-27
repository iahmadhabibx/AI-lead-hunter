import type { LeverSiteConfig } from '@aijh/contracts';
import { defaultFetchJson, fetchJsonWithRetry } from './http';
import {
  ConnectorError,
  type ConnectorCapabilities,
  type ConnectorHealth,
  type DiscoverCursor,
  type DiscoverPage,
  type DiscoverQuery,
  type FetchJson,
  type JobConnector,
  type RawSourceJob,
} from './types';

const DEFAULT_LIMIT = 100;

/**
 * Lever Postings API (public GET, per site name).
 * Docs: https://github.com/lever/postings-api
 * Global host: https://api.lever.co/v0/postings/{SITE}
 * EU host: https://api.eu.lever.co/v0/postings/{SITE}
 * Not a global job search — only the configured employer site.
 */
export class LeverConnector implements JobConnector {
  readonly provider = 'lever' as const;
  readonly sourceKey: string;
  private readonly site: string;
  private readonly fetchJson: FetchJson;
  private readonly baseUrl: string;

  constructor(
    config: LeverSiteConfig,
    opts?: { fetchJson?: FetchJson; baseUrl?: string },
  ) {
    this.sourceKey = config.key;
    this.site = config.site;
    this.fetchJson = opts?.fetchJson ?? defaultFetchJson;
    this.baseUrl =
      opts?.baseUrl ??
      (config.eu
        ? 'https://api.eu.lever.co/v0/postings'
        : 'https://api.lever.co/v0/postings');
  }

  getCapabilities(): ConnectorCapabilities {
    return {
      provider: 'lever',
      requiresAuthForRead: false,
      supportsPagination: true,
      supportsFetchOne: true,
      isGlobalSearch: false,
      attribution: `Lever Postings (${this.site})`,
      documentationUrl: 'https://github.com/lever/postings-api',
      notes: [
        'Coverage is limited to the configured Lever site slug.',
        'Use mode=json for machine-readable postings.',
        'Authenticated Lever API (api.lever.co/v1) is out of scope for Phase 2.',
      ],
    };
  }

  async healthCheck(signal?: AbortSignal): Promise<ConnectorHealth> {
    const started = Date.now();
    const url = `${this.baseUrl}/${encodeURIComponent(this.site)}?mode=json&limit=1`;
    try {
      const res = await fetchJsonWithRetry(
        this.fetchJson,
        url,
        { signal, headers: { accept: 'application/json' } },
        { attempts: 2 },
      );
      if (!res.ok) {
        return {
          ok: false,
          provider: 'lever',
          sourceKey: this.sourceKey,
          checkedAt: new Date().toISOString(),
          detail: `HTTP ${res.status}`,
          latencyMs: Date.now() - started,
        };
      }
      return {
        ok: true,
        provider: 'lever',
        sourceKey: this.sourceKey,
        checkedAt: new Date().toISOString(),
        detail: 'reachable',
        latencyMs: Date.now() - started,
      };
    } catch (err) {
      return {
        ok: false,
        provider: 'lever',
        sourceKey: this.sourceKey,
        checkedAt: new Date().toISOString(),
        detail: err instanceof Error ? err.message : 'health check failed',
        latencyMs: Date.now() - started,
      };
    }
  }

  async discover(
    _query: DiscoverQuery,
    cursor: DiscoverCursor,
    signal?: AbortSignal,
  ): Promise<DiscoverPage> {
    const skip = cursor?.skip ?? 0;
    const url = `${this.baseUrl}/${encodeURIComponent(this.site)}?mode=json&limit=${DEFAULT_LIMIT}&skip=${skip}`;
    const res = await fetchJsonWithRetry(this.fetchJson, url, {
      signal,
      headers: { accept: 'application/json' },
    });

    if (res.status === 404) {
      throw new ConnectorError(
        'not_found',
        `Lever site not found: ${this.site}`,
        { status: 404, retryable: false },
      );
    }
    if (!res.ok) {
      throw new ConnectorError(
        'http_error',
        `Lever list failed: HTTP ${res.status}`,
        { status: res.status, retryable: res.status >= 500 },
      );
    }

    const list = Array.isArray(res.json) ? res.json : [];
    const fetchedAt = new Date().toISOString();
    const jobs: RawSourceJob[] = [];
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const id = (item as { id?: unknown }).id;
      if (id == null) continue;
      jobs.push({
        sourceJobId: String(id),
        raw: item as Record<string, unknown>,
        fetchedAt,
      });
    }

    const nextCursor =
      jobs.length >= DEFAULT_LIMIT ? { skip: skip + jobs.length } : null;

    return { jobs, nextCursor };
  }

  async fetchJob(
    sourceJobId: string,
    signal?: AbortSignal,
  ): Promise<RawSourceJob | null> {
    const url = `${this.baseUrl}/${encodeURIComponent(this.site)}/${encodeURIComponent(sourceJobId)}?mode=json`;
    const res = await fetchJsonWithRetry(this.fetchJson, url, {
      signal,
      headers: { accept: 'application/json' },
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new ConnectorError(
        'http_error',
        `Lever job fetch failed: HTTP ${res.status}`,
        { status: res.status, retryable: res.status >= 500 },
      );
    }
    const raw = res.json as Record<string, unknown>;
    const id = raw.id;
    if (id == null) {
      throw new ConnectorError('parse_error', 'Lever posting missing id');
    }
    return {
      sourceJobId: String(id),
      raw,
      fetchedAt: new Date().toISOString(),
    };
  }
}

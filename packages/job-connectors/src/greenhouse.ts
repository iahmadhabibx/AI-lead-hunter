import type { GreenhouseBoardConfig } from '@aijh/contracts';
import { defaultFetchJson, fetchJsonWithRetry, parseLinkNext } from './http';
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

/**
 * Greenhouse Job Board API (public GET, per board_token).
 * Docs: https://docs.greenhouse.io/job-board.html
 * Not a global job search — only the configured employer board.
 */
export class GreenhouseConnector implements JobConnector {
  readonly provider = 'greenhouse' as const;
  readonly sourceKey: string;
  private readonly boardToken: string;
  private readonly fetchJson: FetchJson;
  private readonly baseUrl: string;

  constructor(
    config: GreenhouseBoardConfig,
    opts?: { fetchJson?: FetchJson; baseUrl?: string },
  ) {
    this.sourceKey = config.key;
    this.boardToken = config.boardToken;
    this.fetchJson = opts?.fetchJson ?? defaultFetchJson;
    this.baseUrl =
      opts?.baseUrl ?? 'https://boards-api.greenhouse.io/v1/boards';
  }

  getCapabilities(): ConnectorCapabilities {
    return {
      provider: 'greenhouse',
      requiresAuthForRead: false,
      supportsPagination: true,
      supportsFetchOne: true,
      isGlobalSearch: false,
      attribution: `Greenhouse Job Board (${this.boardToken})`,
      documentationUrl: 'https://docs.greenhouse.io/job-board.html',
      notes: [
        'Coverage is limited to the configured board_token.',
        'GET endpoints do not require authentication.',
        'Application POST requires a Job Board API key (not used in Phase 2).',
      ],
    };
  }

  async healthCheck(signal?: AbortSignal): Promise<ConnectorHealth> {
    const started = Date.now();
    const url = `${this.baseUrl}/${encodeURIComponent(this.boardToken)}/jobs`;
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
          provider: 'greenhouse',
          sourceKey: this.sourceKey,
          checkedAt: new Date().toISOString(),
          detail: `HTTP ${res.status}`,
          latencyMs: Date.now() - started,
        };
      }
      return {
        ok: true,
        provider: 'greenhouse',
        sourceKey: this.sourceKey,
        checkedAt: new Date().toISOString(),
        detail: 'reachable',
        latencyMs: Date.now() - started,
      };
    } catch (err) {
      return {
        ok: false,
        provider: 'greenhouse',
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
    const url =
      cursor?.nextUrl ??
      `${this.baseUrl}/${encodeURIComponent(this.boardToken)}/jobs?content=true`;

    const res = await fetchJsonWithRetry(this.fetchJson, url, {
      signal,
      headers: { accept: 'application/json' },
    });

    if (res.status === 404) {
      throw new ConnectorError(
        'not_found',
        `Greenhouse board not found: ${this.boardToken}`,
        { status: 404, retryable: false },
      );
    }
    if (!res.ok) {
      throw new ConnectorError(
        'http_error',
        `Greenhouse list failed: HTTP ${res.status}`,
        { status: res.status, retryable: res.status >= 500 },
      );
    }

    const body = res.json as { jobs?: unknown[] };
    const jobsRaw = Array.isArray(body.jobs) ? body.jobs : [];
    const fetchedAt = new Date().toISOString();
    const jobs: RawSourceJob[] = [];
    for (const item of jobsRaw) {
      if (!item || typeof item !== 'object') continue;
      const id = (item as { id?: unknown }).id;
      if (id == null) continue;
      jobs.push({
        sourceJobId: String(id),
        raw: item as Record<string, unknown>,
        fetchedAt,
      });
    }

    const next =
      parseLinkNext(res.headers.get('link')) ??
      parseLinkNext(res.headers.get('Link'));

    return {
      jobs,
      nextCursor: next ? { nextUrl: next } : null,
    };
  }

  async fetchJob(
    sourceJobId: string,
    signal?: AbortSignal,
  ): Promise<RawSourceJob | null> {
    const url = `${this.baseUrl}/${encodeURIComponent(this.boardToken)}/jobs/${encodeURIComponent(sourceJobId)}`;
    const res = await fetchJsonWithRetry(this.fetchJson, url, {
      signal,
      headers: { accept: 'application/json' },
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new ConnectorError(
        'http_error',
        `Greenhouse job fetch failed: HTTP ${res.status}`,
        { status: res.status, retryable: res.status >= 500 },
      );
    }
    const raw = res.json as Record<string, unknown>;
    const id = raw.id;
    if (id == null) {
      throw new ConnectorError('parse_error', 'Greenhouse job missing id');
    }
    return {
      sourceJobId: String(id),
      raw,
      fetchedAt: new Date().toISOString(),
    };
  }
}

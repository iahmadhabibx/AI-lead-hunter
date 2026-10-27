import type { JobSourceProvider } from '@aijh/contracts';

export type DiscoverCursor = {
  /** Opaque skip offset (Lever) */
  skip?: number;
  /** Opaque next URL from Link header (Greenhouse when present) */
  nextUrl?: string;
} | null;

export type DiscoverQuery = {
  /** Reserved for future board-local filters; connectors may ignore. */
  keywords?: string;
};

export type RawSourceJob = {
  sourceJobId: string;
  raw: Record<string, unknown>;
  fetchedAt: string;
};

export type DiscoverPage = {
  jobs: RawSourceJob[];
  nextCursor: DiscoverCursor;
};

export type ConnectorFailureCode =
  | 'http_error'
  | 'timeout'
  | 'parse_error'
  | 'not_found'
  | 'unavailable'
  | 'cancelled';

export class ConnectorError extends Error {
  readonly code: ConnectorFailureCode;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(
    code: ConnectorFailureCode,
    message: string,
    opts?: { status?: number; retryable?: boolean; cause?: unknown },
  ) {
    super(message);
    this.name = 'ConnectorError';
    this.code = code;
    this.status = opts?.status;
    this.retryable = opts?.retryable ?? false;
    if (opts?.cause) {
      (this as Error & { cause?: unknown }).cause = opts.cause;
    }
  }
}

export type ConnectorHealth = {
  ok: boolean;
  provider: JobSourceProvider;
  sourceKey: string;
  checkedAt: string;
  detail?: string;
  latencyMs?: number;
};

export type ConnectorCapabilities = {
  provider: JobSourceProvider;
  requiresAuthForRead: false;
  supportsPagination: boolean;
  supportsFetchOne: boolean;
  isGlobalSearch: false;
  attribution: string;
  documentationUrl: string;
  notes: string[];
};

export interface JobConnector {
  readonly sourceKey: string;
  readonly provider: JobSourceProvider;
  discover(
    query: DiscoverQuery,
    cursor: DiscoverCursor,
    signal?: AbortSignal,
  ): Promise<DiscoverPage>;
  fetchJob(
    sourceJobId: string,
    signal?: AbortSignal,
  ): Promise<RawSourceJob | null>;
  healthCheck(signal?: AbortSignal): Promise<ConnectorHealth>;
  getCapabilities(): ConnectorCapabilities;
}

export type FetchJson = (
  url: string,
  init?: RequestInit,
) => Promise<{ status: number; headers: Headers; json: unknown; ok: boolean }>;

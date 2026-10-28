import { Inject, Injectable } from '@nestjs/common';
import {
  parseJobSourcesJson,
  type JobSourceConfig,
} from '@aijh/contracts';
import { createConnectorRegistry } from '@aijh/job-connectors';
import {
  backgroundTasks,
  canonicalJobs,
  jobSources,
  withTenantContext,
} from '@aijh/database';
import { desc, eq, sql } from 'drizzle-orm';
import { AppHttpException } from '../common/app-http.exception';
import { ConfigService } from '../config/config.service';
import { DatabaseService } from '../database/database.service';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class SourcesService {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(DatabaseService) private readonly dbService: DatabaseService,
    @Inject(QueueService) private readonly queues: QueueService,
  ) {}

  configuredSources(): JobSourceConfig[] {
    return parseJobSourcesJson(this.config.env.JOB_SOURCES_JSON);
  }

  async listStatus() {
    const configured = this.configuredSources();
    const registry = createConnectorRegistry(configured);
    const rows = await this.dbService.db.query.jobSources.findMany({
      orderBy: [desc(jobSources.updatedAt)],
    });
    const byKey = new Map(rows.map((r) => [r.key, r]));

    const sources = registry.map((entry) => {
      const row = byKey.get(entry.config.key);
      const caps = entry.connector?.getCapabilities() ?? null;
      return {
        key: entry.config.key,
        provider: entry.config.type,
        enabled: entry.config.enabled,
        unavailableReason: entry.unavailableReason ?? null,
        isGlobalSearch: false,
        capabilities: caps,
        persistence: row
          ? {
              id: row.id,
              lastHealthOk: row.lastHealthOk === 'true',
              lastHealthDetail: row.lastHealthDetail,
              lastHealthAt: row.lastHealthAt?.toISOString() ?? null,
              lastIngestAt: row.lastIngestAt?.toISOString() ?? null,
              lastIngestError: row.lastIngestError,
            }
          : null,
      };
    });

    const countRows = await this.dbService.db
      .select({ count: sql<number>`count(*)::int` })
      .from(canonicalJobs);
    const canonicalJobCount = countRows[0]?.count ?? 0;

    return {
      sources,
      catalog: {
        canonicalJobCount,
        note: 'Listings only come from configured employer boards — not global search.',
      },
    };
  }

  async triggerDiscover(userId: string, sourceKey?: string) {
    const configured = this.configuredSources();
    if (configured.length === 0) {
      throw new AppHttpException(
        'VALIDATION_ERROR',
        'No job sources configured. Set JOB_SOURCES_JSON to an array of greenhouse/lever board configs.',
      );
    }
    if (sourceKey && !configured.some((c) => c.key === sourceKey)) {
      throw new AppHttpException(
        'NOT_FOUND',
        `Unknown source key: ${sourceKey}`,
      );
    }

    return withTenantContext(this.dbService.db, userId, async (tx) => {
      const [task] = await tx
        .insert(backgroundTasks)
        .values({
          userId,
          type: 'jobs.discover',
          status: 'queued',
          payload: { sourceKey: sourceKey ?? null },
        })
        .returning();

      if (!task) {
        throw new AppHttpException('INTERNAL_ERROR', 'Failed to create task');
      }

      await this.queues.enqueueJobsDiscover({
        sourceKey,
        triggeredBy: userId,
        taskId: task.id,
      });

      return { taskId: task.id, status: 'queued' as const };
    });
  }

  async listJobs(limit = 20) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const rows = await this.dbService.db.query.canonicalJobs.findMany({
      where: eq(canonicalJobs.status, 'active'),
      orderBy: [desc(canonicalJobs.lastSeenAt)],
      limit: safeLimit,
    });
    return {
      jobs: rows.map((j) => ({
        id: j.id,
        title: j.title,
        companyName: j.companyName,
        locationText: j.locationText,
        applyUrl: j.applyUrl,
        sourceAttribution: j.sourceAttribution,
        status: j.status,
        lastSeenAt: j.lastSeenAt.toISOString(),
        contentHash: j.contentHash,
      })),
      note: 'Demo/fixture data is never mixed in. Empty list means no configured board has been ingested yet.',
    };
  }
}

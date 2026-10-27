import {
  parseJobSourcesJson,
  type AppEnv,
  type JobSourceConfig,
} from '@aijh/contracts';
import {
  createConnectorRegistry,
  discoverAllPages,
  type FetchJson,
  type JobConnector,
} from '@aijh/job-connectors';
import {
  contentHashForCanonicalJob,
  dedupeKey,
  normalizeGreenhouseJob,
  normalizeLeverJob,
} from '@aijh/job-normalization';
import {
  canonicalJobs,
  createDb,
  jobSourceLinks,
  jobSources,
  sourceJobs,
} from '@aijh/database';
import type { Logger } from '@aijh/observability';
import { and, eq, inArray, lt, ne } from 'drizzle-orm';

export type JobsDiscoverJobData = {
  sourceKey?: string;
  triggeredBy?: string;
};

function normalizeRaw(
  config: JobSourceConfig,
  raw: Record<string, unknown>,
) {
  if (config.type === 'greenhouse') {
    return normalizeGreenhouseJob(raw, {
      boardToken: config.boardToken,
      companyName: config.displayName ?? config.boardToken,
    });
  }
  return normalizeLeverJob(raw, {
    site: config.site,
    companyName: config.displayName ?? config.site,
  });
}

async function upsertSourceRow(
  db: ReturnType<typeof createDb>,
  config: JobSourceConfig,
) {
  const existing = await db.query.jobSources.findFirst({
    where: eq(jobSources.key, config.key),
  });
  const values = {
    key: config.key,
    provider: config.type,
    displayName: config.displayName ?? config.key,
    config: config as unknown as Record<string, unknown>,
    enabled: config.enabled ? 'true' : 'false',
    updatedAt: new Date(),
  };
  if (existing) {
    const [row] = await db
      .update(jobSources)
      .set(values)
      .where(eq(jobSources.id, existing.id))
      .returning();
    return row!;
  }
  const [row] = await db.insert(jobSources).values(values).returning();
  return row!;
}

async function ingestOneSource(options: {
  db: ReturnType<typeof createDb>;
  logger: Logger;
  env: AppEnv;
  config: JobSourceConfig;
  connector: JobConnector;
}): Promise<{ upserted: number }> {
  const { db, logger, env, config, connector } = options;
  const sourceRow = await upsertSourceRow(db, config);
  const now = new Date();

  const health = await connector.healthCheck();
  await db
    .update(jobSources)
    .set({
      lastHealthOk: health.ok ? 'true' : 'false',
      lastHealthDetail: health.detail ?? null,
      lastHealthAt: now,
      updatedAt: now,
    })
    .where(eq(jobSources.id, sourceRow.id));

  if (!health.ok) {
    await db
      .update(jobSources)
      .set({
        lastIngestError: `Health check failed: ${health.detail ?? 'unknown'}`,
        updatedAt: now,
      })
      .where(eq(jobSources.id, sourceRow.id));
    throw new Error(
      `Source ${config.key} unhealthy: ${health.detail ?? 'unknown'}`,
    );
  }

  const discovered = await discoverAllPages(connector);
  const seenIds: string[] = [];
  let upserted = 0;

  for (const item of discovered) {
    const canonical = normalizeRaw(config, item.raw);
    const hash = contentHashForCanonicalJob(canonical);
    const key = dedupeKey(config.type, config.key, item.sourceJobId);
    seenIds.push(item.sourceJobId);

    let canonicalRow = await db.query.canonicalJobs.findFirst({
      where: eq(canonicalJobs.contentHash, hash),
    });

    if (!canonicalRow) {
      const [created] = await db
        .insert(canonicalJobs)
        .values({
          contentHash: hash,
          normalizationVersion: canonical.normalizationVersion,
          title: canonical.title,
          companyName: canonical.companyName,
          locationText: canonical.locationText,
          descriptionText: canonical.descriptionText,
          descriptionHtml: canonical.descriptionHtml ?? null,
          applyUrl: canonical.applyUrl,
          sourceAttribution: canonical.sourceAttribution,
          departments: canonical.departments,
          offices: canonical.offices,
          workMode: canonical.workMode,
          status: 'active',
          payload: canonical,
          publishedAt: canonical.publishedAt
            ? new Date(canonical.publishedAt)
            : null,
          firstSeenAt: now,
          lastSeenAt: now,
          lastVerifiedAt: now,
        })
        .returning();
      canonicalRow = created;
    } else {
      const [updated] = await db
        .update(canonicalJobs)
        .set({
          title: canonical.title,
          companyName: canonical.companyName,
          locationText: canonical.locationText,
          descriptionText: canonical.descriptionText,
          descriptionHtml: canonical.descriptionHtml ?? null,
          applyUrl: canonical.applyUrl,
          sourceAttribution: canonical.sourceAttribution,
          departments: canonical.departments,
          offices: canonical.offices,
          workMode: canonical.workMode,
          payload: canonical,
          status: 'active',
          lastSeenAt: now,
          lastVerifiedAt: now,
          closedAt: null,
          updatedAt: now,
        })
        .where(eq(canonicalJobs.id, canonicalRow.id))
        .returning();
      canonicalRow = updated ?? canonicalRow;
    }

    if (!canonicalRow) {
      throw new Error('Failed to persist canonical job');
    }

    const existingSource = await db.query.sourceJobs.findFirst({
      where: and(
        eq(sourceJobs.sourceId, sourceRow.id),
        eq(sourceJobs.sourceJobId, item.sourceJobId),
      ),
    });

    let sourceJobId: string;
    if (existingSource) {
      const [updated] = await db
        .update(sourceJobs)
        .set({
          rawPayload: item.raw,
          applyUrl: canonical.applyUrl,
          canonicalJobId: canonicalRow.id,
          status: 'active',
          lastSeenAt: now,
          lastVerifiedAt: now,
          updatedAt: now,
        })
        .where(eq(sourceJobs.id, existingSource.id))
        .returning();
      sourceJobId = updated?.id ?? existingSource.id;
    } else {
      const [created] = await db
        .insert(sourceJobs)
        .values({
          sourceId: sourceRow.id,
          sourceJobId: item.sourceJobId,
          dedupeKey: key,
          canonicalJobId: canonicalRow.id,
          status: 'active',
          rawPayload: item.raw,
          applyUrl: canonical.applyUrl,
          firstSeenAt: now,
          lastSeenAt: now,
          lastVerifiedAt: now,
        })
        .returning();
      sourceJobId = created!.id;
    }

    const linkExists = await db.query.jobSourceLinks.findFirst({
      where: and(
        eq(jobSourceLinks.canonicalJobId, canonicalRow.id),
        eq(jobSourceLinks.sourceJobId, sourceJobId),
      ),
    });
    if (!linkExists) {
      await db.insert(jobSourceLinks).values({
        canonicalJobId: canonicalRow.id,
        sourceJobId,
      });
    }

    upserted += 1;
  }

  // Mark missing listings as stale — never auto-close without confirmation (404).
  const activeForSource = await db.query.sourceJobs.findMany({
    where: and(
      eq(sourceJobs.sourceId, sourceRow.id),
      ne(sourceJobs.status, 'closed'),
    ),
  });
  const missing = activeForSource.filter(
    (row) => !seenIds.includes(row.sourceJobId),
  );
  if (missing.length > 0) {
    await db
      .update(sourceJobs)
      .set({ status: 'stale', updatedAt: now })
      .where(
        inArray(
          sourceJobs.id,
          missing.map((m) => m.id),
        ),
      );
  }

  // Propagate staleness to canonical jobs not seen recently
  const staleBefore = new Date(
    Date.now() - env.JOB_STALE_AFTER_HOURS * 60 * 60 * 1000,
  );
  await db
    .update(canonicalJobs)
    .set({ status: 'stale', updatedAt: now })
    .where(
      and(
        eq(canonicalJobs.status, 'active'),
        lt(canonicalJobs.lastSeenAt, staleBefore),
      ),
    );

  await db
    .update(jobSources)
    .set({
      lastIngestAt: now,
      lastIngestError: null,
      updatedAt: now,
    })
    .where(eq(jobSources.id, sourceRow.id));

  logger.info(
    { sourceKey: config.key, upserted, discovered: discovered.length },
    'Source ingest complete',
  );

  return { upserted };
}

export async function handleJobsDiscover(options: {
  env: AppEnv;
  logger: Logger;
  data: JobsDiscoverJobData;
  /** Injectable for deterministic tests — never used to invent listings in production. */
  fetchJson?: FetchJson;
}): Promise<{ sources: number; upserted: number }> {
  const { env, logger, data } = options;
  const configs = parseJobSourcesJson(env.JOB_SOURCES_JSON).filter((c) =>
    data.sourceKey ? c.key === data.sourceKey : true,
  );
  if (configs.length === 0) {
    logger.warn('No job sources configured (JOB_SOURCES_JSON empty or filtered)');
    return { sources: 0, upserted: 0 };
  }

  const registry = createConnectorRegistry(configs, {
    fetchJson: options.fetchJson,
  });
  const db = createDb(env.DATABASE_URL);
  let upserted = 0;
  let sources = 0;

  for (const entry of registry) {
    if (!entry.config.enabled) {
      await upsertSourceRow(db, entry.config);
      continue;
    }
    if (!entry.connector) {
      logger.warn(
        {
          sourceKey: entry.config.key,
          reason: entry.unavailableReason,
        },
        'Skipping unavailable source',
      );
      continue;
    }
    sources += 1;
    try {
      const result = await ingestOneSource({
        db,
        logger,
        env,
        config: entry.config,
        connector: entry.connector,
      });
      upserted += result.upserted;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ingest failed';
      logger.error({ err, sourceKey: entry.config.key }, 'Source ingest failed');
      const row = await db.query.jobSources.findFirst({
        where: eq(jobSources.key, entry.config.key),
      });
      if (row) {
        await db
          .update(jobSources)
          .set({
            lastIngestError: message.slice(0, 2000),
            updatedAt: new Date(),
          })
          .where(eq(jobSources.id, row.id));
      }
    }
  }

  return { sources, upserted };
}

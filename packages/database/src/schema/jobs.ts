import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const jobListingStatusEnum = pgEnum('job_listing_status', [
  'active',
  'stale',
  'closed',
  'unknown',
]);

export const jobSourceProviderEnum = pgEnum('job_source_provider', [
  'greenhouse',
  'lever',
]);

export const jobSources = pgTable(
  'job_sources',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    key: varchar('key', { length: 120 }).notNull(),
    provider: jobSourceProviderEnum('provider').notNull(),
    displayName: varchar('display_name', { length: 200 }),
    config: jsonb('config').$type<Record<string, unknown>>().notNull(),
    enabled: varchar('enabled', { length: 8 }).notNull().default('true'),
    lastHealthOk: varchar('last_health_ok', { length: 8 }),
    lastHealthDetail: text('last_health_detail'),
    lastHealthAt: timestamp('last_health_at', { withTimezone: true }),
    lastIngestAt: timestamp('last_ingest_at', { withTimezone: true }),
    lastIngestError: text('last_ingest_error'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex('job_sources_key_uidx').on(t.key)],
);

export const canonicalJobs = pgTable(
  'canonical_jobs',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    contentHash: text('content_hash').notNull(),
    normalizationVersion: varchar('normalization_version', {
      length: 32,
    }).notNull(),
    title: text('title').notNull(),
    companyName: text('company_name'),
    locationText: text('location_text'),
    descriptionText: text('description_text'),
    descriptionHtml: text('description_html'),
    applyUrl: text('apply_url').notNull(),
    sourceAttribution: text('source_attribution').notNull(),
    departments: jsonb('departments').$type<string[]>().notNull().default([]),
    offices: jsonb('offices').$type<string[]>().notNull().default([]),
    workMode: varchar('work_mode', { length: 32 }).notNull().default('unknown'),
    status: jobListingStatusEnum('status').notNull().default('active'),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('canonical_jobs_content_hash_uidx').on(t.contentHash),
    index('canonical_jobs_status_idx').on(t.status),
    index('canonical_jobs_last_seen_idx').on(t.lastSeenAt),
  ],
);

export const sourceJobs = pgTable(
  'source_jobs',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => jobSources.id, { onDelete: 'cascade' }),
    sourceJobId: varchar('source_job_id', { length: 200 }).notNull(),
    dedupeKey: varchar('dedupe_key', { length: 320 }).notNull(),
    canonicalJobId: uuid('canonical_job_id').references(() => canonicalJobs.id, {
      onDelete: 'set null',
    }),
    status: jobListingStatusEnum('status').notNull().default('active'),
    rawPayload: jsonb('raw_payload').$type<Record<string, unknown>>().notNull(),
    applyUrl: text('apply_url'),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('source_jobs_source_job_uidx').on(t.sourceId, t.sourceJobId),
    uniqueIndex('source_jobs_dedupe_key_uidx').on(t.dedupeKey),
    index('source_jobs_canonical_idx').on(t.canonicalJobId),
  ],
);

export const jobSourceLinks = pgTable(
  'job_source_links',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    canonicalJobId: uuid('canonical_job_id')
      .notNull()
      .references(() => canonicalJobs.id, { onDelete: 'cascade' }),
    sourceJobId: uuid('source_job_id')
      .notNull()
      .references(() => sourceJobs.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('job_source_links_pair_uidx').on(
      t.canonicalJobId,
      t.sourceJobId,
    ),
  ],
);

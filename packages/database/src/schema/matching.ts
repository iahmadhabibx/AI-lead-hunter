import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { candidateProfileVersions } from './candidate-profiles';
import { canonicalJobs } from './jobs';

export const matchBandEnum = pgEnum('match_band', [
  'eligible',
  'needs_verification',
  'ineligible',
]);

export const matchResults = pgTable(
  'match_results',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    profileVersionId: uuid('profile_version_id')
      .notNull()
      .references(() => candidateProfileVersions.id, { onDelete: 'cascade' }),
    canonicalJobId: uuid('canonical_job_id')
      .notNull()
      .references(() => canonicalJobs.id, { onDelete: 'cascade' }),
    scoringVersion: varchar('scoring_version', { length: 32 }).notNull(),
    jobContentHash: text('job_content_hash').notNull(),
    band: matchBandEnum('band').notNull(),
    suitabilityPercent: real('suitability_percent'),
    breakdown: jsonb('breakdown').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('match_results_unique_uidx').on(
      t.userId,
      t.profileVersionId,
      t.canonicalJobId,
      t.scoringVersion,
    ),
    index('match_results_user_id_idx').on(t.userId),
    index('match_results_band_idx').on(t.band),
  ],
);

export const savedJobs = pgTable(
  'saved_jobs',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    canonicalJobId: uuid('canonical_job_id')
      .notNull()
      .references(() => canonicalJobs.id, { onDelete: 'cascade' }),
    matchResultId: uuid('match_result_id').references(() => matchResults.id, {
      onDelete: 'set null',
    }),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('saved_jobs_user_job_uidx').on(t.userId, t.canonicalJobId),
    index('saved_jobs_user_id_idx').on(t.userId),
  ],
);

export const feedbackEventTypeEnum = pgEnum('feedback_event_type', [
  'interested',
  'saved',
  'unsaved',
  'rejected',
  'applied',
  'interview_received',
  'offer_received',
  'marked_expired',
  'marked_irrelevant',
]);

export const feedbackEvents = pgTable(
  'feedback_events',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    canonicalJobId: uuid('canonical_job_id')
      .notNull()
      .references(() => canonicalJobs.id, { onDelete: 'cascade' }),
    matchResultId: uuid('match_result_id').references(() => matchResults.id, {
      onDelete: 'set null',
    }),
    type: feedbackEventTypeEnum('type').notNull(),
    rejectionReasons: jsonb('rejection_reasons').$type<string[]>().notNull().default([]),
    note: text('note'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('feedback_events_user_id_idx').on(t.userId),
    index('feedback_events_job_idx').on(t.canonicalJobId),
    index('feedback_events_created_at_idx').on(t.createdAt),
  ],
);

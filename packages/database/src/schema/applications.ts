import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { candidateProfileVersions } from './candidate-profiles';
import { canonicalJobs } from './jobs';
import { matchResults } from './matching';

export const applicationStatusEnum = pgEnum('application_status', [
  'drafting',
  'ready_for_review',
  'approved',
  'applied',
  'withdrawn',
  'archived',
]);

export const documentTypeEnum = pgEnum('document_type', [
  'tailored_cv',
  'cover_letter',
  'application_answers',
]);

export const documentStatusEnum = pgEnum('document_status', [
  'draft',
  'pending_review',
  'approved',
  'superseded',
]);

export const applications = pgTable(
  'applications',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    canonicalJobId: uuid('canonical_job_id')
      .notNull()
      .references(() => canonicalJobs.id, { onDelete: 'cascade' }),
    profileVersionId: uuid('profile_version_id')
      .notNull()
      .references(() => candidateProfileVersions.id, { onDelete: 'restrict' }),
    matchResultId: uuid('match_result_id').references(() => matchResults.id, {
      onDelete: 'set null',
    }),
    status: applicationStatusEnum('status').notNull().default('drafting'),
    officialApplyUrl: text('official_apply_url').notNull(),
    note: text('note'),
    appliedAt: timestamp('applied_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('applications_user_job_uidx').on(t.userId, t.canonicalJobId),
    index('applications_user_id_idx').on(t.userId),
    index('applications_status_idx').on(t.status),
  ],
);

export const generatedDocuments = pgTable(
  'generated_documents',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    type: documentTypeEnum('type').notNull(),
    versionNumber: integer('version_number').notNull(),
    status: documentStatusEnum('status').notNull().default('draft'),
    generationVersion: varchar('generation_version', { length: 32 }).notNull(),
    title: text('title').notNull(),
    contentMarkdown: text('content_markdown').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    provenance: jsonb('provenance').$type<Record<string, unknown>>().notNull(),
    unsupportedClaims: jsonb('unsupported_claims')
      .$type<string[]>()
      .notNull()
      .default([]),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('generated_documents_app_type_version_uidx').on(
      t.applicationId,
      t.type,
      t.versionNumber,
    ),
    index('generated_documents_user_id_idx').on(t.userId),
    index('generated_documents_application_id_idx').on(t.applicationId),
  ],
);

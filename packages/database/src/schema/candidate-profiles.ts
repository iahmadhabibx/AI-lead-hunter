import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { cvDocuments } from './cv-documents';

export const profileVersionStatusEnum = pgEnum('profile_version_status', [
  'pending_review',
  'approved',
  'superseded',
]);

export const candidateProfiles = pgTable(
  'candidate_profiles',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    activeVersionId: uuid('active_version_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex('candidate_profiles_user_id_uidx').on(t.userId)],
);

export const candidateProfileVersions = pgTable(
  'candidate_profile_versions',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => candidateProfiles.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    status: profileVersionStatusEnum('status')
      .notNull()
      .default('pending_review'),
    schemaVersion: varchar('schema_version', { length: 32 }).notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    provenance: jsonb('provenance')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    sourceDocumentId: uuid('source_document_id').references(
      () => cvDocuments.id,
      { onDelete: 'set null' },
    ),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    errorMessage: text('error_message'),
  },
  (t) => [
    index('candidate_profile_versions_user_id_idx').on(t.userId),
    index('candidate_profile_versions_profile_id_idx').on(t.profileId),
    uniqueIndex('candidate_profile_versions_profile_version_uidx').on(
      t.profileId,
      t.versionNumber,
    ),
  ],
);

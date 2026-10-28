import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const learnedPreferenceStatusEnum = pgEnum('learned_preference_status', [
  'active',
  'reset',
]);

export const learnedPreferences = pgTable(
  'learned_preferences',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    status: learnedPreferenceStatusEnum('status').notNull().default('active'),
    learningVersion: varchar('learning_version', { length: 32 }).notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    resetAt: timestamp('reset_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('learned_preferences_user_version_uidx').on(
      t.userId,
      t.versionNumber,
    ),
    index('learned_preferences_user_id_idx').on(t.userId),
  ],
);

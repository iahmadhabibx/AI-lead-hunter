import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const backgroundTaskStatusEnum = pgEnum('background_task_status', [
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
]);

export const backgroundTasks = pgTable(
  'background_tasks',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 80 }).notNull(),
    status: backgroundTaskStatusEnum('status').notNull().default('queued'),
    payload: jsonb('payload').$type<Record<string, unknown>>().default({}),
    result: jsonb('result').$type<Record<string, unknown>>(),
    errorMessage: text('error_message'),
    idempotencyKey: varchar('idempotency_key', { length: 128 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('background_tasks_user_id_idx').on(t.userId),
    index('background_tasks_status_idx').on(t.status),
    index('background_tasks_idempotency_idx').on(t.userId, t.idempotencyKey),
  ],
);

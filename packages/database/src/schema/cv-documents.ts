import { sql } from 'drizzle-orm';
import {
  bigint,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const cvDocumentStatusEnum = pgEnum('cv_document_status', [
  'uploaded',
  'processing',
  'extracted',
  'failed',
]);

export const cvDocuments = pgTable(
  'cv_documents',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    originalFilename: varchar('original_filename', { length: 255 }).notNull(),
    detectedFormat: varchar('detected_format', { length: 16 }).notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    contentHash: text('content_hash').notNull(),
    storagePath: text('storage_path').notNull(),
    status: cvDocumentStatusEnum('status').notNull().default('uploaded'),
    errorMessage: text('error_message'),
    extractedTextChars: bigint('extracted_text_chars', { mode: 'number' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('cv_documents_user_id_idx').on(t.userId),
    index('cv_documents_status_idx').on(t.status),
  ],
);

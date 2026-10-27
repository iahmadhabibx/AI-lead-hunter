import { sql } from 'drizzle-orm';
import type { Database } from './client';
import { TENANT_SETTING_KEY } from '@aijh/security';

/**
 * Set PostgreSQL session variable used by RLS policies.
 * Call inside a transaction for connection-pool safety.
 */
export async function withTenantContext<T>(
  db: Database,
  userId: string,
  fn: (tx: Database) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config(${TENANT_SETTING_KEY}, ${userId}, true)`,
    );
    return fn(tx as unknown as Database);
  });
}

import { sql } from 'drizzle-orm';
import type { Database } from './client';

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
      sql`select set_config('app.current_user_id', ${userId}, true)`,
    );
    return fn(tx as unknown as Database);
  });
}

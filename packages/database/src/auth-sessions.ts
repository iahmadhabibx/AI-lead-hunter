import { sql } from 'drizzle-orm';
import type { Database } from './client';

export type AuthSessionUser = {
  sessionId: string;
  userId: string;
  email: string;
  displayName: string | null;
  userStatus: string;
  userCreatedAt: Date;
};

export async function createAuthSession(
  db: Database,
  input: { userId: string; tokenHash: string; expiresAt: Date },
): Promise<string> {
  const rows = await db.execute<{ auth_create_session: string }>(sql`
    select auth_create_session(
      ${input.userId}::uuid,
      ${input.tokenHash},
      ${input.expiresAt.toISOString()}::timestamptz
    ) as auth_create_session
  `);
  const id = rows[0]?.auth_create_session;
  if (!id) {
    throw new Error('Failed to create session');
  }
  return id;
}

export async function findValidAuthSession(
  db: Database,
  tokenHash: string,
): Promise<AuthSessionUser | null> {
  const rows = await db.execute<{
    session_id: string;
    user_id: string;
    email: string;
    display_name: string | null;
    user_status: string;
    user_created_at: Date | string;
  }>(sql`
    select * from auth_find_valid_session(${tokenHash})
  `);
  const row = rows[0];
  if (!row) return null;
  return {
    sessionId: row.session_id,
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
    userStatus: row.user_status,
    userCreatedAt:
      row.user_created_at instanceof Date
        ? row.user_created_at
        : new Date(row.user_created_at),
  };
}

export async function revokeAuthSession(
  db: Database,
  tokenHash: string,
): Promise<void> {
  await db.execute(sql`select auth_revoke_session(${tokenHash})`);
}

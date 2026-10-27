import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  backgroundTasks,
  createDb,
  users,
  withTenantContext,
} from '@aijh/database';
import { hashPassword } from '@aijh/security';
import { eq } from 'drizzle-orm';

const databaseUrl = process.env.DATABASE_URL;
const hasDb = Boolean(databaseUrl);

describe.runIf(hasDb)('tenant isolation (RLS)', () => {
  const db = createDb(databaseUrl!);
  let userAId = '';
  let userBId = '';
  let taskAId = '';

  beforeAll(async () => {
    const passwordHash = await hashPassword('tenant-isolation-password');
    const stamp = Date.now();

    const [userA] = await db
      .insert(users)
      .values({
        email: `tenant-a-${stamp}@example.com`,
        passwordHash,
        displayName: 'Tenant A',
      })
      .returning();
    const [userB] = await db
      .insert(users)
      .values({
        email: `tenant-b-${stamp}@example.com`,
        passwordHash,
        displayName: 'Tenant B',
      })
      .returning();

    if (!userA || !userB) {
      throw new Error('Failed to seed tenant users');
    }
    userAId = userA.id;
    userBId = userB.id;

    const task = await withTenantContext(db, userAId, async (tx) => {
      const [row] = await tx
        .insert(backgroundTasks)
        .values({
          userId: userAId,
          type: 'cv.process',
          status: 'queued',
          payload: { fixture: true },
        })
        .returning();
      return row;
    });

    if (!task) {
      throw new Error('Failed to seed background task for tenant A');
    }
    taskAId = task.id;
  });

  afterAll(async () => {
    // Cleanup via owner bypass is unavailable on aijh_app; delete through tenant context.
    if (userAId) {
      await withTenantContext(db, userAId, async (tx) => {
        await tx
          .delete(backgroundTasks)
          .where(eq(backgroundTasks.userId, userAId));
      });
    }
    if (userAId) {
      await db.delete(users).where(eq(users.id, userAId));
    }
    if (userBId) {
      await db.delete(users).where(eq(users.id, userBId));
    }
  });

  it('allows the owning tenant to read their background task', async () => {
    const rows = await withTenantContext(db, userAId, async (tx) =>
      tx.query.backgroundTasks.findMany({
        where: eq(backgroundTasks.id, taskAId),
      }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId).toBe(userAId);
  });

  it('blocks another tenant from reading that background task', async () => {
    const rows = await withTenantContext(db, userBId, async (tx) =>
      tx.query.backgroundTasks.findMany({
        where: eq(backgroundTasks.id, taskAId),
      }),
    );
    expect(rows).toHaveLength(0);
  });

  it('rejects inserting a background task for a different tenant id', async () => {
    await expect(
      withTenantContext(db, userBId, async (tx) =>
        tx.insert(backgroundTasks).values({
          userId: userAId,
          type: 'cv.process',
          status: 'queued',
          payload: { shouldFail: true },
        }),
      ),
    ).rejects.toThrow();
  });
});

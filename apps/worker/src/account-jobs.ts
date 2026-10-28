import type { AppEnv } from '@aijh/contracts';
import { resolveStorageRoot } from '@aijh/contracts';
import {
  applications,
  auditEvents,
  backgroundTasks,
  candidateProfiles,
  candidateProfileVersions,
  createDb,
  cvDocuments,
  feedbackEvents,
  generatedDocuments,
  learnedPreferences,
  matchResults,
  savedJobs,
  users,
  withTenantContext,
} from '@aijh/database';
import type { Logger } from '@aijh/observability';
import { eq } from 'drizzle-orm';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';

export type AccountExportJobData = {
  userId: string;
  taskId: string;
};

export type AccountDeleteJobData = {
  userId: string;
  taskId: string;
};

export async function handleAccountExport(opts: {
  env: AppEnv;
  logger: Logger;
  data: AccountExportJobData;
}): Promise<{ exportPath: string }> {
  const { env, logger, data } = opts;
  const db = createDb(env.DATABASE_URL);

  try {
    await withTenantContext(db, data.userId, async (tx) => {
      await tx
        .update(backgroundTasks)
        .set({ status: 'running', updatedAt: new Date() })
        .where(eq(backgroundTasks.id, data.taskId));
    });

    const dump = await withTenantContext(db, data.userId, async (tx) => {
      const [
        userRows,
        profiles,
        versions,
        docs,
        matches,
        saved,
        feedback,
        prefs,
        apps,
        genDocs,
        audits,
        tasks,
      ] = await Promise.all([
        db.select().from(users).where(eq(users.id, data.userId)).limit(1),
        tx.query.candidateProfiles.findMany({
          where: eq(candidateProfiles.userId, data.userId),
        }),
        tx.query.candidateProfileVersions.findMany({
          where: eq(candidateProfileVersions.userId, data.userId),
        }),
        tx.query.cvDocuments.findMany({
          where: eq(cvDocuments.userId, data.userId),
        }),
        tx.query.matchResults.findMany({
          where: eq(matchResults.userId, data.userId),
        }),
        tx.query.savedJobs.findMany({
          where: eq(savedJobs.userId, data.userId),
        }),
        tx.query.feedbackEvents.findMany({
          where: eq(feedbackEvents.userId, data.userId),
        }),
        tx.query.learnedPreferences.findMany({
          where: eq(learnedPreferences.userId, data.userId),
        }),
        tx.query.applications.findMany({
          where: eq(applications.userId, data.userId),
        }),
        tx.query.generatedDocuments.findMany({
          where: eq(generatedDocuments.userId, data.userId),
        }),
        db
          .select()
          .from(auditEvents)
          .where(eq(auditEvents.userId, data.userId)),
        tx.query.backgroundTasks.findMany({
          where: eq(backgroundTasks.userId, data.userId),
        }),
      ]);

      const user = userRows[0];
      return {
        exportedAt: new Date().toISOString(),
        note: 'Personal data export. CV binary files are listed by metadata only; request support for raw file retrieval if needed.',
        user: user
          ? {
              id: user.id,
              email: user.email,
              displayName: user.displayName,
              status: user.status,
              createdAt: user.createdAt.toISOString(),
            }
          : null,
        candidateProfiles: profiles,
        candidateProfileVersions: versions,
        cvDocuments: docs.map((d) => ({
          id: d.id,
          originalFilename: d.originalFilename,
          detectedFormat: d.detectedFormat,
          sizeBytes: d.sizeBytes,
          status: d.status,
          storagePath: d.storagePath,
          createdAt: d.createdAt.toISOString(),
        })),
        matchResults: matches,
        savedJobs: saved,
        feedbackEvents: feedback,
        learnedPreferences: prefs,
        applications: apps,
        generatedDocuments: genDocs.map((d) => ({
          id: d.id,
          type: d.type,
          versionNumber: d.versionNumber,
          status: d.status,
          title: d.title,
          contentMarkdown: d.contentMarkdown,
          provenance: d.provenance,
          unsupportedClaims: d.unsupportedClaims,
        })),
        auditEvents: audits.map((a) => ({
          id: a.id,
          action: a.action,
          resourceType: a.resourceType,
          resourceId: a.resourceId,
          createdAt: a.createdAt.toISOString(),
        })),
        backgroundTasks: tasks.map((t) => ({
          id: t.id,
          type: t.type,
          status: t.status,
          createdAt: t.createdAt.toISOString(),
        })),
      };
    });

    const storageRoot = resolveStorageRoot(env.STORAGE_ROOT);
    const exportDir = path.join(storageRoot, data.userId, 'exports');
    await mkdir(exportDir, { recursive: true, mode: 0o700 });
    const filename = `export-${data.taskId}.json`;
    const absolute = path.join(exportDir, filename);
    await writeFile(absolute, JSON.stringify(dump, null, 2), {
      mode: 0o600,
      encoding: 'utf8',
    });
    const exportPath = path.posix.join(data.userId, 'exports', filename);

    await withTenantContext(db, data.userId, async (tx) => {
      await tx
        .update(backgroundTasks)
        .set({
          status: 'succeeded',
          result: { exportPath },
          updatedAt: new Date(),
        })
        .where(eq(backgroundTasks.id, data.taskId));
    });

    logger.info({ exportPath }, 'Account export complete');
    return { exportPath };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Export failed';
    logger.error({ err }, message);
    await withTenantContext(db, data.userId, async (tx) => {
      await tx
        .update(backgroundTasks)
        .set({
          status: 'failed',
          errorMessage: message,
          updatedAt: new Date(),
        })
        .where(eq(backgroundTasks.id, data.taskId));
    });
    throw err;
  }
}

export async function handleAccountDelete(opts: {
  env: AppEnv;
  logger: Logger;
  data: AccountDeleteJobData;
}): Promise<{ deleted: true }> {
  const { env, logger, data } = opts;
  const db = createDb(env.DATABASE_URL);

  try {
    await withTenantContext(db, data.userId, async (tx) => {
      await tx
        .update(backgroundTasks)
        .set({ status: 'running', updatedAt: new Date() })
        .where(eq(backgroundTasks.id, data.taskId));
    });

    // Delete private files first
    const storageRoot = resolveStorageRoot(env.STORAGE_ROOT);
    const userDir = path.join(storageRoot, data.userId);
    const relative = path.relative(storageRoot, path.resolve(userDir));
    if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
      await rm(userDir, { recursive: true, force: true });
    }

    // Mark task succeeded before user cascade removes it
    await withTenantContext(db, data.userId, async (tx) => {
      await tx
        .update(backgroundTasks)
        .set({
          status: 'succeeded',
          result: { deleted: true },
          updatedAt: new Date(),
        })
        .where(eq(backgroundTasks.id, data.taskId));
    });

    await db.insert(auditEvents).values({
      userId: data.userId,
      action: 'account.delete.completed',
      resourceType: 'user',
      resourceId: data.userId,
      metadata: { note: 'User row will be removed; audit may retain hashed refs.' },
    });

    // Cascade deletes owned rows via FKs
    await db.delete(users).where(eq(users.id, data.userId));

    logger.info({ userId: data.userId }, 'Account deleted');
    return { deleted: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Delete failed';
    logger.error({ err }, message);
    try {
      await withTenantContext(db, data.userId, async (tx) => {
        await tx
          .update(backgroundTasks)
          .set({
            status: 'failed',
            errorMessage: message,
            updatedAt: new Date(),
          })
          .where(eq(backgroundTasks.id, data.taskId));
      });
    } catch {
      /* user may already be gone */
    }
    throw err;
  }
}

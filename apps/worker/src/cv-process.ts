import { createDefaultAiRuntime, processCvBuffer } from '@aijh/cv-processing';
import {
  backgroundTasks,
  candidateProfiles,
  candidateProfileVersions,
  createDb,
  cvDocuments,
  withTenantContext,
} from '@aijh/database';
import type { AppEnv } from '@aijh/contracts';
import { resolveStorageRoot } from '@aijh/contracts';
import type { Logger } from '@aijh/observability';
import { and, desc, eq } from 'drizzle-orm';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export type CvProcessJobData = {
  userId: string;
  documentId: string;
  taskId: string;
};

export async function handleCvProcessJob(options: {
  env: AppEnv;
  logger: Logger;
  data: CvProcessJobData;
}): Promise<void> {
  const { env, logger, data } = options;
  const db = createDb(env.DATABASE_URL);
  const ai = createDefaultAiRuntime(env);
  const storageRoot = resolveStorageRoot(env.STORAGE_ROOT);

  try {
    await withTenantContext(db, data.userId, async (tx) => {
      await tx
        .update(backgroundTasks)
        .set({ status: 'running', updatedAt: new Date() })
        .where(
          and(
            eq(backgroundTasks.id, data.taskId),
            eq(backgroundTasks.userId, data.userId),
          ),
        );

      await tx
        .update(cvDocuments)
        .set({ status: 'processing', updatedAt: new Date() })
        .where(
          and(
            eq(cvDocuments.id, data.documentId),
            eq(cvDocuments.userId, data.userId),
          ),
        );
    });

    const doc = await withTenantContext(db, data.userId, async (tx) =>
      tx.query.cvDocuments.findFirst({
        where: and(
          eq(cvDocuments.id, data.documentId),
          eq(cvDocuments.userId, data.userId),
        ),
      }),
    );

    if (!doc) {
      throw new Error('CV document not found for processing');
    }

    const absolutePath = path.resolve(storageRoot, doc.storagePath);
    if (!absolutePath.startsWith(storageRoot)) {
      throw new Error('Invalid storage path');
    }
    const buffer = await readFile(absolutePath);

    const processed = await processCvBuffer({
      buffer,
      maxBytes: env.MAX_UPLOAD_BYTES,
      ai,
      documentId: doc.id,
    });

    await withTenantContext(db, data.userId, async (tx) => {
      let profile = await tx.query.candidateProfiles.findFirst({
        where: eq(candidateProfiles.userId, data.userId),
      });
      if (!profile) {
        const [created] = await tx
          .insert(candidateProfiles)
          .values({ userId: data.userId })
          .returning();
        profile = created;
      }
      if (!profile) {
        throw new Error('Failed to create candidate profile');
      }

      // Supersede any prior pending drafts from older uploads
      await tx
        .update(candidateProfileVersions)
        .set({ status: 'superseded' })
        .where(
          and(
            eq(candidateProfileVersions.profileId, profile.id),
            eq(candidateProfileVersions.status, 'pending_review'),
          ),
        );

      const latest = await tx.query.candidateProfileVersions.findFirst({
        where: eq(candidateProfileVersions.profileId, profile.id),
        orderBy: [desc(candidateProfileVersions.versionNumber)],
      });
      const nextVersion = (latest?.versionNumber ?? 0) + 1;

      const [version] = await tx
        .insert(candidateProfileVersions)
        .values({
          profileId: profile.id,
          userId: data.userId,
          versionNumber: nextVersion,
          status: 'pending_review',
          schemaVersion: processed.extraction.payload.schemaVersion,
          payload: processed.extraction.payload,
          provenance: {
            provider: processed.extraction.provider,
            model: processed.extraction.model,
            promptVersion: processed.extraction.promptVersion,
            format: processed.format,
            extractedAt: new Date().toISOString(),
          },
          sourceDocumentId: doc.id,
        })
        .returning();

      await tx
        .update(cvDocuments)
        .set({
          status: 'extracted',
          extractedTextChars: processed.text.length,
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(cvDocuments.id, doc.id));

      await tx
        .update(backgroundTasks)
        .set({
          status: 'succeeded',
          result: {
            profileVersionId: version?.id,
            documentId: doc.id,
          },
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(backgroundTasks.id, data.taskId));
    });

    logger.info(
      { documentId: data.documentId, taskId: data.taskId },
      'CV processed successfully',
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Processing failed';
    logger.error(
      { err, documentId: data.documentId, taskId: data.taskId },
      'CV processing failed',
    );
    await withTenantContext(db, data.userId, async (tx) => {
      await tx
        .update(cvDocuments)
        .set({
          status: 'failed',
          errorMessage: message.slice(0, 2000),
          updatedAt: new Date(),
        })
        .where(eq(cvDocuments.id, data.documentId));
      await tx
        .update(backgroundTasks)
        .set({
          status: 'failed',
          errorMessage: message.slice(0, 2000),
          updatedAt: new Date(),
        })
        .where(eq(backgroundTasks.id, data.taskId));
    });
    throw err;
  }
}

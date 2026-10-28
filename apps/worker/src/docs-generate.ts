import {
  CandidateProfilePayloadSchema,
  CanonicalJobSchema,
  DRAFT_GENERATION_VERSION,
  type AppEnv,
  type DocumentType,
} from '@aijh/contracts';
import { generateGroundedDrafts } from '@aijh/application-assistance';
import {
  applications,
  backgroundTasks,
  candidateProfileVersions,
  canonicalJobs,
  createDb,
  generatedDocuments,
  withTenantContext,
} from '@aijh/database';
import type { Logger } from '@aijh/observability';
import { and, desc, eq } from 'drizzle-orm';

export type DocsGenerateJobData = {
  userId: string;
  taskId?: string;
  applicationId: string;
  types?: DocumentType[];
};

export type DocsGenerateResult = {
  applicationId: string;
  documentsCreated: number;
  generationVersion: typeof DRAFT_GENERATION_VERSION;
};

export async function handleDocsGenerate(opts: {
  env: AppEnv;
  logger: Logger;
  data: DocsGenerateJobData;
}): Promise<DocsGenerateResult> {
  const { env, logger, data } = opts;
  const db = createDb(env.DATABASE_URL);

  try {
    if (data.taskId) {
      await withTenantContext(db, data.userId, async (tx) => {
        await tx
          .update(backgroundTasks)
          .set({ status: 'running', updatedAt: new Date() })
          .where(eq(backgroundTasks.id, data.taskId!));
      });
    }

    const result = await withTenantContext(db, data.userId, async (tx) => {
      const app = await tx.query.applications.findFirst({
        where: and(
          eq(applications.id, data.applicationId),
          eq(applications.userId, data.userId),
        ),
      });
      if (!app) {
        throw new Error('Application not found');
      }

      const version = await tx.query.candidateProfileVersions.findFirst({
        where: and(
          eq(candidateProfileVersions.id, app.profileVersionId),
          eq(candidateProfileVersions.userId, data.userId),
          eq(candidateProfileVersions.status, 'approved'),
        ),
      });
      if (!version) {
        throw new Error('Approved profile version not found for application');
      }

      const jobRow = await tx.query.canonicalJobs.findFirst({
        where: eq(canonicalJobs.id, app.canonicalJobId),
      });
      // Catalog may need non-tenant query
      const job =
        jobRow ??
        (
          await db.query.canonicalJobs.findFirst({
            where: eq(canonicalJobs.id, app.canonicalJobId),
          })
        );

      if (!job) {
        throw new Error('Canonical job not found');
      }

      const profile = CandidateProfilePayloadSchema.parse(version.payload);
      const canonical = CanonicalJobSchema.parse(job.payload);

      const generated = generateGroundedDrafts({
        profile,
        job: canonical,
        profileVersionId: version.id,
        jobContentHash: job.contentHash,
        canonicalJobId: job.id,
        types: data.types,
      });

      let documentsCreated = 0;
      for (const doc of generated.documents) {
        const existing = await tx.query.generatedDocuments.findMany({
          where: and(
            eq(generatedDocuments.applicationId, app.id),
            eq(generatedDocuments.type, doc.type),
            eq(generatedDocuments.userId, data.userId),
          ),
          orderBy: [desc(generatedDocuments.versionNumber)],
          limit: 1,
        });
        const prev = existing[0];
        const nextVersion = (prev?.versionNumber ?? 0) + 1;

        if (prev && prev.status !== 'superseded') {
          await tx
            .update(generatedDocuments)
            .set({ status: 'superseded', updatedAt: new Date() })
            .where(eq(generatedDocuments.id, prev.id));
        }

        await tx.insert(generatedDocuments).values({
          userId: data.userId,
          applicationId: app.id,
          type: doc.type,
          versionNumber: nextVersion,
          status:
            doc.unsupportedClaims.length > 0 ? 'draft' : 'pending_review',
          generationVersion: DRAFT_GENERATION_VERSION,
          title: doc.title,
          contentMarkdown: doc.contentMarkdown,
          payload: doc,
          provenance: generated.provenance,
          unsupportedClaims: doc.unsupportedClaims,
        });
        documentsCreated += 1;
      }

      await tx
        .update(applications)
        .set({ status: 'ready_for_review', updatedAt: new Date() })
        .where(eq(applications.id, app.id));

      return {
        applicationId: app.id,
        documentsCreated,
        generationVersion: DRAFT_GENERATION_VERSION,
      };
    });

    if (data.taskId) {
      await withTenantContext(db, data.userId, async (tx) => {
        await tx
          .update(backgroundTasks)
          .set({
            status: 'succeeded',
            result,
            updatedAt: new Date(),
          })
          .where(eq(backgroundTasks.id, data.taskId!));
      });
    }

    logger.info(result, 'Draft generation complete');
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Draft generation failed';
    logger.error({ err }, message);
    if (data.taskId) {
      await withTenantContext(db, data.userId, async (tx) => {
        await tx
          .update(backgroundTasks)
          .set({
            status: 'failed',
            errorMessage: message,
            updatedAt: new Date(),
          })
          .where(eq(backgroundTasks.id, data.taskId!));
      });
    }
    throw err;
  }
}

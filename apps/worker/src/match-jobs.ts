import {
  CandidateProfilePayloadSchema,
  CanonicalJobSchema,
  MATCH_SCORING_VERSION,
  type AppEnv,
} from '@aijh/contracts';
import {
  backgroundTasks,
  candidateProfiles,
  candidateProfileVersions,
  canonicalJobs,
  createDb,
  matchResults,
  withTenantContext,
} from '@aijh/database';
import { matchProfileToJob } from '@aijh/matching';
import type { Logger } from '@aijh/observability';
import { and, eq, inArray } from 'drizzle-orm';

export type JobsMatchJobData = {
  userId: string;
  taskId?: string;
  /** Optional subset; default = all active catalog jobs (bounded). */
  canonicalJobIds?: string[];
  limit?: number;
};

export type JobsMatchResult = {
  matched: number;
  profileVersionId: string;
  scoringVersion: typeof MATCH_SCORING_VERSION;
};

export async function handleJobsMatch(opts: {
  env: AppEnv;
  logger: Logger;
  data: JobsMatchJobData;
}): Promise<JobsMatchResult> {
  const { env, logger, data } = opts;
  const db = createDb(env.DATABASE_URL);
  const limit = Math.min(Math.max(data.limit ?? 200, 1), 500);

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
      const profile = await tx.query.candidateProfiles.findFirst({
        where: eq(candidateProfiles.userId, data.userId),
      });
      if (!profile?.activeVersionId) {
        throw new Error('No approved active profile version to match');
      }

      const version = await tx.query.candidateProfileVersions.findFirst({
        where: and(
          eq(candidateProfileVersions.id, profile.activeVersionId),
          eq(candidateProfileVersions.userId, data.userId),
          eq(candidateProfileVersions.status, 'approved'),
        ),
      });
      if (!version) {
        throw new Error('Active profile version not found or not approved');
      }

      const payload = CandidateProfilePayloadSchema.parse(version.payload);

      const jobRows = data.canonicalJobIds?.length
        ? await tx.query.canonicalJobs.findMany({
            where: inArray(canonicalJobs.id, data.canonicalJobIds),
            limit,
          })
        : await tx.query.canonicalJobs.findMany({
            where: eq(canonicalJobs.status, 'active'),
            limit,
          });

      // Catalog reads are allowed without tenant filter; RLS is not on canonical_jobs.
      // Re-query via shared db connection for jobs if tenant tx cannot see them —
      // actually aijh_app has GRANT on catalog without RLS, so findMany works.

      let matched = 0;
      for (const row of jobRows) {
        const job = CanonicalJobSchema.parse(row.payload);
        const scored = matchProfileToJob({
          profile: payload,
          job,
          jobStatus: row.status,
          jobContentHash: row.contentHash,
          profileVersionId: version.id,
        });

        const breakdown = {
          scoringVersion: scored.scoringVersion,
          band: scored.band,
          suitabilityPercent: scored.suitabilityPercent,
          hardFilters: scored.hardFilters,
          components: scored.components,
          evidence: scored.evidence,
          missingRequirements: scored.missingRequirements,
          unknownFields: scored.unknownFields,
          disclaimer: scored.disclaimer,
        };

        await tx
          .insert(matchResults)
          .values({
            userId: data.userId,
            profileVersionId: version.id,
            canonicalJobId: row.id,
            scoringVersion: MATCH_SCORING_VERSION,
            jobContentHash: row.contentHash,
            band: scored.band,
            suitabilityPercent: scored.suitabilityPercent,
            breakdown,
          })
          .onConflictDoUpdate({
            target: [
              matchResults.userId,
              matchResults.profileVersionId,
              matchResults.canonicalJobId,
              matchResults.scoringVersion,
            ],
            set: {
              jobContentHash: row.contentHash,
              band: scored.band,
              suitabilityPercent: scored.suitabilityPercent,
              breakdown,
              updatedAt: new Date(),
            },
          });
        matched += 1;
      }

      return {
        matched,
        profileVersionId: version.id,
        scoringVersion: MATCH_SCORING_VERSION,
      };
    });

    if (data.taskId) {
      await withTenantContext(db, data.userId, async (tx) => {
        await tx
          .update(backgroundTasks)
          .set({
            status: 'succeeded',
            result: result,
            updatedAt: new Date(),
          })
          .where(eq(backgroundTasks.id, data.taskId!));
      });
    }

    logger.info(result, 'Matching complete');
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Matching failed';
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

import { Inject, Injectable } from '@nestjs/common';
import {
  FeedbackCreateSchema,
  type FeedbackCreate,
} from '@aijh/contracts';
import {
  auditEvents,
  backgroundTasks,
  candidateProfiles,
  canonicalJobs,
  feedbackEvents,
  matchResults,
  savedJobs,
  withTenantContext,
} from '@aijh/database';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { AppHttpException } from '../common/app-http.exception';
import { DatabaseService } from '../database/database.service';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class MatchService {
  constructor(
    @Inject(DatabaseService) private readonly dbService: DatabaseService,
    @Inject(QueueService) private readonly queues: QueueService,
  ) {}

  async triggerMatch(userId: string, opts?: { limit?: number }) {
    return withTenantContext(this.dbService.db, userId, async (tx) => {
      const profile = await tx.query.candidateProfiles.findFirst({
        where: eq(candidateProfiles.userId, userId),
      });
      if (!profile?.activeVersionId) {
        throw new AppHttpException(
          'VALIDATION_ERROR',
          'Approve a candidate profile before running matching.',
        );
      }

      const [task] = await tx
        .insert(backgroundTasks)
        .values({
          userId,
          type: 'jobs.match',
          status: 'queued',
          payload: { limit: opts?.limit ?? 200 },
        })
        .returning();

      if (!task) {
        throw new AppHttpException('INTERNAL_ERROR', 'Failed to create match task');
      }

      await this.queues.enqueueJobsMatch({
        userId,
        taskId: task.id,
        limit: opts?.limit,
      });

      return { taskId: task.id, status: 'queued' as const };
    });
  }

  async listMatches(userId: string, limit = 50) {
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    return withTenantContext(this.dbService.db, userId, async (tx) => {
      const rows = await tx.query.matchResults.findMany({
        where: eq(matchResults.userId, userId),
        orderBy: [desc(matchResults.updatedAt)],
        limit: safeLimit,
      });

      const jobIds = [...new Set(rows.map((r) => r.canonicalJobId))];
      const jobs =
        jobIds.length === 0
          ? []
          : await this.dbService.db.query.canonicalJobs.findMany({
              where: inArray(canonicalJobs.id, jobIds),
            });
      const jobMap = new Map(jobs.map((j) => [j.id, j]));

      return {
        scoringNote:
          'suitabilityPercent is a weighted suitability score, not interview or hiring probability.',
        matches: rows.map((r) => {
          const job = jobMap.get(r.canonicalJobId);
          return {
            id: r.id,
            band: r.band,
            suitabilityPercent: r.suitabilityPercent,
            scoringVersion: r.scoringVersion,
            profileVersionId: r.profileVersionId,
            canonicalJobId: r.canonicalJobId,
            job: job
              ? {
                  title: job.title,
                  companyName: job.companyName,
                  locationText: job.locationText,
                  workMode: job.workMode,
                  applyUrl: job.applyUrl,
                  status: job.status,
                  publishedAt: job.publishedAt?.toISOString() ?? null,
                  lastSeenAt: job.lastSeenAt.toISOString(),
                }
              : null,
            updatedAt: r.updatedAt.toISOString(),
          };
        }),
      };
    });
  }

  async getMatch(userId: string, matchId: string) {
    return withTenantContext(this.dbService.db, userId, async (tx) => {
      const row = await tx.query.matchResults.findFirst({
        where: and(
          eq(matchResults.id, matchId),
          eq(matchResults.userId, userId),
        ),
      });
      if (!row) {
        throw new AppHttpException('NOT_FOUND', 'Match result not found');
      }
      const job = await this.dbService.db.query.canonicalJobs.findFirst({
        where: eq(canonicalJobs.id, row.canonicalJobId),
      });
      return {
        id: row.id,
        band: row.band,
        suitabilityPercent: row.suitabilityPercent,
        scoringVersion: row.scoringVersion,
        jobContentHash: row.jobContentHash,
        profileVersionId: row.profileVersionId,
        canonicalJobId: row.canonicalJobId,
        breakdown: row.breakdown,
        job: job
          ? {
              id: job.id,
              title: job.title,
              companyName: job.companyName,
              locationText: job.locationText,
              workMode: job.workMode,
              applyUrl: job.applyUrl,
              status: job.status,
              sourceAttribution: job.sourceAttribution,
            }
          : null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    });
  }

  async saveJob(
    userId: string,
    body: { canonicalJobId: string; matchResultId?: string; note?: string },
  ) {
    return withTenantContext(this.dbService.db, userId, async (tx) => {
      const job = await this.dbService.db.query.canonicalJobs.findFirst({
        where: eq(canonicalJobs.id, body.canonicalJobId),
      });
      if (!job) {
        throw new AppHttpException('NOT_FOUND', 'Job not found');
      }

      const [saved] = await tx
        .insert(savedJobs)
        .values({
          userId,
          canonicalJobId: body.canonicalJobId,
          matchResultId: body.matchResultId,
          note: body.note,
        })
        .onConflictDoUpdate({
          target: [savedJobs.userId, savedJobs.canonicalJobId],
          set: {
            matchResultId: body.matchResultId,
            note: body.note,
            updatedAt: new Date(),
          },
        })
        .returning();

      await tx.insert(feedbackEvents).values({
        userId,
        canonicalJobId: body.canonicalJobId,
        matchResultId: body.matchResultId,
        type: 'saved',
        rejectionReasons: [],
        note: body.note,
      });

      await tx.insert(auditEvents).values({
        userId,
        action: 'job.saved',
        resourceType: 'canonical_job',
        resourceId: body.canonicalJobId,
        metadata: { matchResultId: body.matchResultId ?? null },
      });

      return {
        id: saved!.id,
        canonicalJobId: saved!.canonicalJobId,
        createdAt: saved!.createdAt.toISOString(),
      };
    });
  }

  async unsaveJob(userId: string, canonicalJobId: string) {
    return withTenantContext(this.dbService.db, userId, async (tx) => {
      const deleted = await tx
        .delete(savedJobs)
        .where(
          and(
            eq(savedJobs.userId, userId),
            eq(savedJobs.canonicalJobId, canonicalJobId),
          ),
        )
        .returning();
      if (deleted.length === 0) {
        throw new AppHttpException('NOT_FOUND', 'Saved job not found');
      }

      await tx.insert(feedbackEvents).values({
        userId,
        canonicalJobId,
        type: 'unsaved',
        rejectionReasons: [],
      });

      await tx.insert(auditEvents).values({
        userId,
        action: 'job.unsaved',
        resourceType: 'canonical_job',
        resourceId: canonicalJobId,
      });

      return { ok: true as const };
    });
  }

  async listSaved(userId: string) {
    return withTenantContext(this.dbService.db, userId, async (tx) => {
      const rows = await tx.query.savedJobs.findMany({
        where: eq(savedJobs.userId, userId),
        orderBy: [desc(savedJobs.createdAt)],
      });
      const jobIds = rows.map((r) => r.canonicalJobId);
      const jobs =
        jobIds.length === 0
          ? []
          : await this.dbService.db.query.canonicalJobs.findMany({
              where: inArray(canonicalJobs.id, jobIds),
            });
      const jobMap = new Map(jobs.map((j) => [j.id, j]));
      return {
        saved: rows.map((r) => ({
          id: r.id,
          canonicalJobId: r.canonicalJobId,
          note: r.note,
          createdAt: r.createdAt.toISOString(),
          job: jobMap.get(r.canonicalJobId)
            ? {
                title: jobMap.get(r.canonicalJobId)!.title,
                companyName: jobMap.get(r.canonicalJobId)!.companyName,
                applyUrl: jobMap.get(r.canonicalJobId)!.applyUrl,
              }
            : null,
        })),
      };
    });
  }

  async rejectJob(userId: string, raw: unknown) {
    const body = FeedbackCreateSchema.parse({
      ...(raw as object),
      type: 'rejected',
    }) as FeedbackCreate;

    return withTenantContext(this.dbService.db, userId, async (tx) => {
      const job = await this.dbService.db.query.canonicalJobs.findFirst({
        where: eq(canonicalJobs.id, body.canonicalJobId),
      });
      if (!job) {
        throw new AppHttpException('NOT_FOUND', 'Job not found');
      }

      const [event] = await tx
        .insert(feedbackEvents)
        .values({
          userId,
          canonicalJobId: body.canonicalJobId,
          matchResultId: body.matchResultId,
          type: 'rejected',
          rejectionReasons: body.rejectionReasons,
          note: body.note,
        })
        .returning();

      await tx.insert(auditEvents).values({
        userId,
        action: 'job.rejected',
        resourceType: 'canonical_job',
        resourceId: body.canonicalJobId,
        metadata: {
          feedbackEventId: event!.id,
          rejectionReasons: body.rejectionReasons,
        },
      });

      return {
        feedbackEventId: event!.id,
        type: event!.type,
        createdAt: event!.createdAt.toISOString(),
      };
    });
  }

  async createFeedback(userId: string, raw: unknown) {
    const body = FeedbackCreateSchema.parse(raw);
    return withTenantContext(this.dbService.db, userId, async (tx) => {
      const job = await this.dbService.db.query.canonicalJobs.findFirst({
        where: eq(canonicalJobs.id, body.canonicalJobId),
      });
      if (!job) {
        throw new AppHttpException('NOT_FOUND', 'Job not found');
      }

      const [event] = await tx
        .insert(feedbackEvents)
        .values({
          userId,
          canonicalJobId: body.canonicalJobId,
          matchResultId: body.matchResultId,
          type: body.type,
          rejectionReasons: body.rejectionReasons,
          note: body.note,
        })
        .returning();

      await tx.insert(auditEvents).values({
        userId,
        action: `feedback.${body.type}`,
        resourceType: 'canonical_job',
        resourceId: body.canonicalJobId,
        metadata: { feedbackEventId: event!.id },
      });

      return {
        id: event!.id,
        type: event!.type,
        createdAt: event!.createdAt.toISOString(),
      };
    });
  }

  async listFeedback(userId: string, limit = 50) {
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    return withTenantContext(this.dbService.db, userId, async (tx) => {
      const rows = await tx.query.feedbackEvents.findMany({
        where: eq(feedbackEvents.userId, userId),
        orderBy: [desc(feedbackEvents.createdAt)],
        limit: safeLimit,
      });
      return {
        events: rows.map((r) => ({
          id: r.id,
          type: r.type,
          canonicalJobId: r.canonicalJobId,
          matchResultId: r.matchResultId,
          rejectionReasons: r.rejectionReasons,
          note: r.note,
          createdAt: r.createdAt.toISOString(),
        })),
      };
    });
  }
}

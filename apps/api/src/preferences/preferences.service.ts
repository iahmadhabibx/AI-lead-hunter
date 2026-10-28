import { Inject, Injectable } from '@nestjs/common';
import {
  LearnedPreferencesPayloadSchema,
  PREFERENCE_LEARNING_VERSION,
  type LearnedPreferencesPublic,
} from '@aijh/contracts';
import {
  auditEvents,
  canonicalJobs,
  feedbackEvents,
  learnedPreferences,
  withTenantContext,
} from '@aijh/database';
import {
  computeLearnedPreferences,
  type FeedbackEventForLearning,
} from '@aijh/feedback';
import { desc, eq, inArray } from 'drizzle-orm';
import { AppHttpException } from '../common/app-http.exception';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class PreferencesService {
  constructor(
    @Inject(DatabaseService) private readonly dbService: DatabaseService,
  ) {}

  async getActive(userId: string): Promise<LearnedPreferencesPublic | null> {
    return withTenantContext(this.dbService.db, userId, async (tx) => {
      const row = await tx.query.learnedPreferences.findFirst({
        where: eq(learnedPreferences.userId, userId),
        orderBy: [desc(learnedPreferences.versionNumber)],
      });
      if (!row || row.status !== 'active') return null;
      return this.toPublic(row);
    });
  }

  async recompute(userId: string): Promise<LearnedPreferencesPublic> {
    return withTenantContext(this.dbService.db, userId, async (tx) => {
      const events = await tx.query.feedbackEvents.findMany({
        where: eq(feedbackEvents.userId, userId),
        orderBy: [desc(feedbackEvents.createdAt)],
        limit: 500,
      });

      const jobIds = [...new Set(events.map((e) => e.canonicalJobId))];
      const jobs =
        jobIds.length === 0
          ? []
          : await this.dbService.db.query.canonicalJobs.findMany({
              where: inArray(canonicalJobs.id, jobIds),
            });
      const jobMap = new Map(jobs.map((j) => [j.id, j]));

      const forLearning: FeedbackEventForLearning[] = events.map((e) => {
        const job = jobMap.get(e.canonicalJobId);
        return {
          id: e.id,
          type: e.type,
          rejectionReasons: (e.rejectionReasons ?? []) as FeedbackEventForLearning['rejectionReasons'],
          canonicalJobId: e.canonicalJobId,
          jobTitle: job?.title ?? null,
          jobWorkMode: (job?.workMode as FeedbackEventForLearning['jobWorkMode']) ?? null,
          jobDepartments: job?.departments ?? [],
          jobDescriptionText: job?.descriptionText ?? null,
        };
      });

      const payload = computeLearnedPreferences(forLearning);

      const latest = await tx.query.learnedPreferences.findFirst({
        where: eq(learnedPreferences.userId, userId),
        orderBy: [desc(learnedPreferences.versionNumber)],
      });
      const nextVersion = (latest?.versionNumber ?? 0) + 1;

      if (latest && latest.status === 'active') {
        await tx
          .update(learnedPreferences)
          .set({ status: 'reset', resetAt: new Date() })
          .where(eq(learnedPreferences.id, latest.id));
      }

      const [row] = await tx
        .insert(learnedPreferences)
        .values({
          userId,
          versionNumber: nextVersion,
          status: 'active',
          learningVersion: PREFERENCE_LEARNING_VERSION,
          payload,
        })
        .returning();

      await tx.insert(auditEvents).values({
        userId,
        action: 'preferences.learned.recompute',
        resourceType: 'learned_preferences',
        resourceId: row!.id,
        metadata: {
          versionNumber: nextVersion,
          sourceEventCount: payload.sourceEventCount,
        },
      });

      return this.toPublic(row!);
    });
  }

  async reset(userId: string): Promise<{ ok: true; resetId: string | null }> {
    return withTenantContext(this.dbService.db, userId, async (tx) => {
      const active = await tx.query.learnedPreferences.findFirst({
        where: eq(learnedPreferences.userId, userId),
        orderBy: [desc(learnedPreferences.versionNumber)],
      });
      if (!active || active.status !== 'active') {
        return { ok: true as const, resetId: null };
      }

      await tx
        .update(learnedPreferences)
        .set({ status: 'reset', resetAt: new Date() })
        .where(eq(learnedPreferences.id, active.id));

      await tx.insert(auditEvents).values({
        userId,
        action: 'preferences.learned.reset',
        resourceType: 'learned_preferences',
        resourceId: active.id,
        metadata: { previousVersion: active.versionNumber },
      });

      return { ok: true as const, resetId: active.id };
    });
  }

  private toPublic(row: {
    id: string;
    versionNumber: number;
    status: 'active' | 'reset';
    payload: unknown;
    createdAt: Date;
    resetAt: Date | null;
  }): LearnedPreferencesPublic {
    const payload = LearnedPreferencesPayloadSchema.parse(row.payload);
    if (row.status !== 'active') {
      throw new AppHttpException(
        'INTERNAL_ERROR',
        'Cannot expose non-active learned preferences as active',
      );
    }
    return {
      id: row.id,
      versionNumber: row.versionNumber,
      status: 'active',
      payload,
      createdAt: row.createdAt.toISOString(),
      resetAt: row.resetAt ? row.resetAt.toISOString() : null,
      note: 'Learned preferences are deterministic summaries of your feedback events. Explicit profile preferences always override them. CV facts are never mutated.',
    };
  }
}

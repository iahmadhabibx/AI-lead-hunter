import { Inject, Injectable } from '@nestjs/common';
import {
  CandidateProfilePayloadSchema,
  calculateExperienceMonths,
  type CandidateProfilePayload,
  type ProfileVersionPublic,
} from '@aijh/contracts';
import {
  candidateProfiles,
  candidateProfileVersions,
  withTenantContext,
} from '@aijh/database';
import { and, desc, eq } from 'drizzle-orm';
import { AppHttpException } from '../common/app-http.exception';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class ProfileService {
  constructor(
    @Inject(DatabaseService) private readonly dbService: DatabaseService,
  ) {}

  async getCurrent(userId: string): Promise<{
    profileId: string | null;
    activeVersion: ProfileVersionPublic | null;
    pendingVersion: ProfileVersionPublic | null;
  }> {
    return withTenantContext(this.dbService.db, userId, async (tx) => {
      const profile = await tx.query.candidateProfiles.findFirst({
        where: eq(candidateProfiles.userId, userId),
      });
      if (!profile) {
        return { profileId: null, activeVersion: null, pendingVersion: null };
      }

      const versions = await tx.query.candidateProfileVersions.findMany({
        where: eq(candidateProfileVersions.profileId, profile.id),
        orderBy: [desc(candidateProfileVersions.versionNumber)],
      });

      const pending = versions.find((v) => v.status === 'pending_review');
      const active = profile.activeVersionId
        ? versions.find((v) => v.id === profile.activeVersionId)
        : versions.find((v) => v.status === 'approved');

      return {
        profileId: profile.id,
        activeVersion: active ? this.toPublic(active) : null,
        pendingVersion: pending ? this.toPublic(pending) : null,
      };
    });
  }

  async listVersions(userId: string): Promise<ProfileVersionPublic[]> {
    return withTenantContext(this.dbService.db, userId, async (tx) => {
      const rows = await tx.query.candidateProfileVersions.findMany({
        where: eq(candidateProfileVersions.userId, userId),
        orderBy: [desc(candidateProfileVersions.versionNumber)],
      });
      return rows.map((r) => this.toPublic(r));
    });
  }

  async updatePendingDraft(
    userId: string,
    payloadRaw: unknown,
  ): Promise<ProfileVersionPublic> {
    const parsed = CandidateProfilePayloadSchema.parse(payloadRaw);
    const payload = CandidateProfilePayloadSchema.parse({
      ...parsed,
      totalExperienceMonths: calculateExperienceMonths(parsed.employment),
    });

    return withTenantContext(this.dbService.db, userId, async (tx) => {
      const pending = await tx.query.candidateProfileVersions.findFirst({
        where: and(
          eq(candidateProfileVersions.userId, userId),
          eq(candidateProfileVersions.status, 'pending_review'),
        ),
        orderBy: [desc(candidateProfileVersions.versionNumber)],
      });
      if (!pending) {
        throw new AppHttpException(
          'NOT_FOUND',
          'No pending profile draft to update',
        );
      }

      const [updated] = await tx
        .update(candidateProfileVersions)
        .set({
          payload,
          provenance: {
            ...(pending.provenance as Record<string, unknown>),
            lastUserEditAt: new Date().toISOString(),
          },
        })
        .where(eq(candidateProfileVersions.id, pending.id))
        .returning();

      if (!updated) {
        throw new AppHttpException('INTERNAL_ERROR', 'Failed to update draft');
      }
      return this.toPublic(updated);
    });
  }

  async approvePending(userId: string): Promise<ProfileVersionPublic> {
    return withTenantContext(this.dbService.db, userId, async (tx) => {
      const profile = await tx.query.candidateProfiles.findFirst({
        where: eq(candidateProfiles.userId, userId),
      });
      if (!profile) {
        throw new AppHttpException('NOT_FOUND', 'Profile not found');
      }

      const pending = await tx.query.candidateProfileVersions.findFirst({
        where: and(
          eq(candidateProfileVersions.profileId, profile.id),
          eq(candidateProfileVersions.status, 'pending_review'),
        ),
        orderBy: [desc(candidateProfileVersions.versionNumber)],
      });
      if (!pending) {
        throw new AppHttpException(
          'NOT_FOUND',
          'No pending profile available to approve',
        );
      }

      // Freeze: mark previous approved as superseded
      await tx
        .update(candidateProfileVersions)
        .set({ status: 'superseded' })
        .where(
          and(
            eq(candidateProfileVersions.profileId, profile.id),
            eq(candidateProfileVersions.status, 'approved'),
          ),
        );

      const approvedAt = new Date();
      const [approved] = await tx
        .update(candidateProfileVersions)
        .set({ status: 'approved', approvedAt })
        .where(eq(candidateProfileVersions.id, pending.id))
        .returning();

      if (!approved) {
        throw new AppHttpException('INTERNAL_ERROR', 'Failed to approve profile');
      }

      await tx
        .update(candidateProfiles)
        .set({
          activeVersionId: approved.id,
          updatedAt: new Date(),
        })
        .where(eq(candidateProfiles.id, profile.id));

      return this.toPublic(approved);
    });
  }

  private toPublic(row: {
    id: string;
    versionNumber: number;
    status: 'pending_review' | 'approved' | 'superseded';
    schemaVersion: string;
    payload: unknown;
    sourceDocumentId: string | null;
    createdAt: Date;
    approvedAt: Date | null;
  }): ProfileVersionPublic {
    const payload = CandidateProfilePayloadSchema.parse(
      row.payload,
    ) as CandidateProfilePayload;
    return {
      id: row.id,
      versionNumber: row.versionNumber,
      status: row.status,
      schemaVersion: row.schemaVersion,
      payload,
      sourceDocumentId: row.sourceDocumentId,
      createdAt: row.createdAt.toISOString(),
      approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
    };
  }
}

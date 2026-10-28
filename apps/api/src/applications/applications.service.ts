import { Inject, Injectable } from '@nestjs/common';
import {
  ApplicationCreateSchema,
  ApplicationStatusUpdateSchema,
  DocumentUpdateSchema,
  DraftGenerateRequestSchema,
  GeneratedDocumentPayloadSchema,
  type ApplicationStatus,
} from '@aijh/contracts';
import {
  applications,
  auditEvents,
  backgroundTasks,
  candidateProfiles,
  candidateProfileVersions,
  canonicalJobs,
  generatedDocuments,
  withTenantContext,
} from '@aijh/database';
import { exportDocumentMarkdown } from '@aijh/application-assistance';
import { and, desc, eq, sql } from 'drizzle-orm';
import { AppHttpException } from '../common/app-http.exception';
import { DatabaseService } from '../database/database.service';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class ApplicationsService {
  constructor(
    @Inject(DatabaseService) private readonly dbService: DatabaseService,
    @Inject(QueueService) private readonly queues: QueueService,
  ) {}

  async create(userId: string, raw: unknown) {
    const body = ApplicationCreateSchema.parse(raw);
    return withTenantContext(this.dbService.db, userId, async (tx) => {
      const profile = await tx.query.candidateProfiles.findFirst({
        where: eq(candidateProfiles.userId, userId),
      });
      if (!profile?.activeVersionId) {
        throw new AppHttpException(
          'VALIDATION_ERROR',
          'Approve a candidate profile before creating an application.',
        );
      }

      const version = await tx.query.candidateProfileVersions.findFirst({
        where: and(
          eq(candidateProfileVersions.id, profile.activeVersionId),
          eq(candidateProfileVersions.userId, userId),
          eq(candidateProfileVersions.status, 'approved'),
        ),
      });
      if (!version) {
        throw new AppHttpException(
          'VALIDATION_ERROR',
          'Active approved profile version not found.',
        );
      }

      const job = await this.dbService.db.query.canonicalJobs.findFirst({
        where: eq(canonicalJobs.id, body.canonicalJobId),
      });
      if (!job) {
        throw new AppHttpException('NOT_FOUND', 'Job not found');
      }

      const [app] = await tx
        .insert(applications)
        .values({
          userId,
          canonicalJobId: body.canonicalJobId,
          profileVersionId: version.id,
          matchResultId: body.matchResultId,
          status: 'drafting',
          officialApplyUrl: job.applyUrl,
          note: body.note,
        })
        .onConflictDoUpdate({
          target: [applications.userId, applications.canonicalJobId],
          set: {
            note: body.note,
            matchResultId: body.matchResultId,
            updatedAt: new Date(),
          },
        })
        .returning();

      await tx.insert(auditEvents).values({
        userId,
        action: 'application.created',
        resourceType: 'application',
        resourceId: app!.id,
        metadata: {
          canonicalJobId: body.canonicalJobId,
          officialApplyUrl: job.applyUrl,
        },
      });

      return this.toApplicationPublic(app!, job.title, job.companyName);
    });
  }

  async list(userId: string) {
    return withTenantContext(this.dbService.db, userId, async (tx) => {
      const rows = await tx.query.applications.findMany({
        where: eq(applications.userId, userId),
        orderBy: [desc(applications.updatedAt)],
      });
      return {
        applications: rows.map((r) => ({
          id: r.id,
          canonicalJobId: r.canonicalJobId,
          profileVersionId: r.profileVersionId,
          status: r.status,
          officialApplyUrl: r.officialApplyUrl,
          note: r.note,
          appliedAt: r.appliedAt?.toISOString() ?? null,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        })),
        submissionPolicy:
          'Applications are never submitted automatically. Use officialApplyUrl manually after approving drafts.',
      };
    });
  }

  async get(userId: string, applicationId: string) {
    return withTenantContext(this.dbService.db, userId, async (tx) => {
      const app = await this.requireApp(tx, userId, applicationId);
      const docs = await tx.query.generatedDocuments.findMany({
        where: and(
          eq(generatedDocuments.applicationId, applicationId),
          eq(generatedDocuments.userId, userId),
        ),
        orderBy: [desc(generatedDocuments.versionNumber)],
      });
      const job = await this.dbService.db.query.canonicalJobs.findFirst({
        where: eq(canonicalJobs.id, app.canonicalJobId),
      });
      return {
        ...this.toApplicationPublic(app, job?.title ?? null, job?.companyName ?? null),
        documents: docs.map((d) => this.toDocSummary(d)),
      };
    });
  }

  async updateStatus(userId: string, applicationId: string, raw: unknown) {
    const body = ApplicationStatusUpdateSchema.parse(raw);
    if (body.status === 'applied') {
      // Tracking only — never automate submission
    }
    return withTenantContext(this.dbService.db, userId, async (tx) => {
      await this.requireApp(tx, userId, applicationId);
      const patch: {
        status: ApplicationStatus;
        note?: string;
        appliedAt?: Date;
        updatedAt: Date;
      } = {
        status: body.status,
        updatedAt: new Date(),
      };
      if (body.note !== undefined) patch.note = body.note;
      if (body.status === 'applied') patch.appliedAt = new Date();

      const [updated] = await tx
        .update(applications)
        .set(patch)
        .where(
          and(
            eq(applications.id, applicationId),
            eq(applications.userId, userId),
          ),
        )
        .returning();

      await tx.insert(auditEvents).values({
        userId,
        action: `application.status.${body.status}`,
        resourceType: 'application',
        resourceId: applicationId,
        metadata: { note: body.note ?? null },
      });

      return {
        id: updated!.id,
        status: updated!.status,
        officialApplyUrl: updated!.officialApplyUrl,
        appliedAt: updated!.appliedAt?.toISOString() ?? null,
        submissionPolicy:
          'Status "applied" is user-reported tracking only. This system does not submit applications.',
      };
    });
  }

  async enqueueGenerate(userId: string, raw: unknown) {
    const body = DraftGenerateRequestSchema.parse(raw);
    return withTenantContext(this.dbService.db, userId, async (tx) => {
      await this.requireApp(tx, userId, body.applicationId);

      const [task] = await tx
        .insert(backgroundTasks)
        .values({
          userId,
          type: 'docs.generate',
          status: 'queued',
          payload: {
            applicationId: body.applicationId,
            types: body.types,
          },
        })
        .returning();

      await this.queues.enqueueDocsGenerate({
        userId,
        taskId: task!.id,
        applicationId: body.applicationId,
        types: body.types,
      });

      return { taskId: task!.id, status: 'queued' as const };
    });
  }

  async getDocument(userId: string, documentId: string) {
    return withTenantContext(this.dbService.db, userId, async (tx) => {
      const doc = await tx.query.generatedDocuments.findFirst({
        where: and(
          eq(generatedDocuments.id, documentId),
          eq(generatedDocuments.userId, userId),
        ),
      });
      if (!doc) {
        throw new AppHttpException('NOT_FOUND', 'Document not found');
      }
      return this.toDocDetail(doc);
    });
  }

  async updateDocument(userId: string, documentId: string, raw: unknown) {
    const body = DocumentUpdateSchema.parse(raw);
    return withTenantContext(this.dbService.db, userId, async (tx) => {
      const doc = await tx.query.generatedDocuments.findFirst({
        where: and(
          eq(generatedDocuments.id, documentId),
          eq(generatedDocuments.userId, userId),
        ),
      });
      if (!doc) {
        throw new AppHttpException('NOT_FOUND', 'Document not found');
      }
      if (doc.status === 'approved') {
        throw new AppHttpException(
          'CONFLICT',
          'Approved documents are immutable. Generate a new version to edit further.',
        );
      }

      const prevPayload = GeneratedDocumentPayloadSchema.parse(doc.payload);
      const nextPayload = GeneratedDocumentPayloadSchema.parse({
        ...prevPayload,
        contentMarkdown: body.contentMarkdown,
        // User edits: clear auto claims until re-validated on next generate
        claims: [],
        unsupportedClaims: [],
        missingEvidenceNotes: [
          ...prevPayload.missingEvidenceNotes,
          'User edited content — re-run generation or manually verify claims before approval.',
        ],
      });

      const [updated] = await tx
        .update(generatedDocuments)
        .set({
          contentMarkdown: body.contentMarkdown,
          payload: nextPayload,
          unsupportedClaims: [],
          status: 'pending_review',
          updatedAt: new Date(),
        })
        .where(eq(generatedDocuments.id, documentId))
        .returning();

      await tx.insert(auditEvents).values({
        userId,
        action: 'document.edited',
        resourceType: 'generated_document',
        resourceId: documentId,
      });

      return this.toDocDetail(updated!);
    });
  }

  async approveDocument(userId: string, documentId: string) {
    return withTenantContext(this.dbService.db, userId, async (tx) => {
      const doc = await tx.query.generatedDocuments.findFirst({
        where: and(
          eq(generatedDocuments.id, documentId),
          eq(generatedDocuments.userId, userId),
        ),
      });
      if (!doc) {
        throw new AppHttpException('NOT_FOUND', 'Document not found');
      }
      if (doc.unsupportedClaims.length > 0) {
        throw new AppHttpException(
          'VALIDATION_ERROR',
          `Cannot approve document with unsupported claims: ${doc.unsupportedClaims.slice(0, 5).join('; ')}`,
        );
      }

      const [updated] = await tx
        .update(generatedDocuments)
        .set({
          status: 'approved',
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(generatedDocuments.id, documentId))
        .returning();

      await tx.insert(auditEvents).values({
        userId,
        action: 'document.approved',
        resourceType: 'generated_document',
        resourceId: documentId,
      });

      // If all latest docs approved, mark application ready/approved
      await this.refreshApplicationStatus(tx, userId, doc.applicationId);

      return this.toDocDetail(updated!);
    });
  }

  async exportDocument(userId: string, documentId: string) {
    return withTenantContext(this.dbService.db, userId, async (tx) => {
      const doc = await tx.query.generatedDocuments.findFirst({
        where: and(
          eq(generatedDocuments.id, documentId),
          eq(generatedDocuments.userId, userId),
        ),
      });
      if (!doc) {
        throw new AppHttpException('NOT_FOUND', 'Document not found');
      }
      const payload = GeneratedDocumentPayloadSchema.parse(doc.payload);
      const exported = exportDocumentMarkdown(
        {
          ...payload,
          contentMarkdown: doc.contentMarkdown,
        },
        { applicationId: doc.applicationId },
      );

      await tx.insert(auditEvents).values({
        userId,
        action: 'document.exported',
        resourceType: 'generated_document',
        resourceId: documentId,
      });

      return exported;
    });
  }

  private async refreshApplicationStatus(
    tx: Parameters<Parameters<typeof withTenantContext>[2]>[0],
    userId: string,
    applicationId: string,
  ) {
    const docs = await tx.query.generatedDocuments.findMany({
      where: and(
        eq(generatedDocuments.applicationId, applicationId),
        eq(generatedDocuments.userId, userId),
      ),
    });
    const latestByType = new Map<string, (typeof docs)[0]>();
    for (const d of docs) {
      const prev = latestByType.get(d.type);
      if (!prev || d.versionNumber > prev.versionNumber) {
        latestByType.set(d.type, d);
      }
    }
    const latest = [...latestByType.values()];
    if (latest.length === 0) return;
    const allApproved = latest.every((d) => d.status === 'approved');
    const anyPending = latest.some(
      (d) => d.status === 'draft' || d.status === 'pending_review',
    );
    let status: ApplicationStatus = 'drafting';
    if (allApproved) status = 'approved';
    else if (!anyPending) status = 'ready_for_review';
    else status = 'ready_for_review';

    await tx
      .update(applications)
      .set({ status, updatedAt: new Date() })
      .where(
        and(
          eq(applications.id, applicationId),
          eq(applications.userId, userId),
          sql`${applications.status} not in ('applied', 'withdrawn', 'archived')`,
        ),
      );
  }

  private async requireApp(
    tx: Parameters<Parameters<typeof withTenantContext>[2]>[0],
    userId: string,
    applicationId: string,
  ) {
    const app = await tx.query.applications.findFirst({
      where: and(
        eq(applications.id, applicationId),
        eq(applications.userId, userId),
      ),
    });
    if (!app) {
      throw new AppHttpException('NOT_FOUND', 'Application not found');
    }
    return app;
  }

  private toApplicationPublic(
    app: {
      id: string;
      canonicalJobId: string;
      profileVersionId: string;
      status: ApplicationStatus;
      officialApplyUrl: string;
      note: string | null;
      appliedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    },
    jobTitle: string | null,
    companyName: string | null,
  ) {
    return {
      id: app.id,
      canonicalJobId: app.canonicalJobId,
      profileVersionId: app.profileVersionId,
      status: app.status,
      officialApplyUrl: app.officialApplyUrl,
      note: app.note,
      jobTitle,
      companyName,
      appliedAt: app.appliedAt?.toISOString() ?? null,
      createdAt: app.createdAt.toISOString(),
      updatedAt: app.updatedAt.toISOString(),
      submissionPolicy:
        'Never submitted automatically. Open officialApplyUrl yourself after review.',
    };
  }

  private toDocSummary(d: {
    id: string;
    type: string;
    versionNumber: number;
    status: string;
    title: string;
    generationVersion: string;
    unsupportedClaims: string[];
    approvedAt: Date | null;
    updatedAt: Date;
  }) {
    return {
      id: d.id,
      type: d.type,
      versionNumber: d.versionNumber,
      status: d.status,
      title: d.title,
      generationVersion: d.generationVersion,
      unsupportedClaimCount: d.unsupportedClaims.length,
      approvedAt: d.approvedAt?.toISOString() ?? null,
      updatedAt: d.updatedAt.toISOString(),
    };
  }

  private toDocDetail(d: {
    id: string;
    applicationId: string;
    type: string;
    versionNumber: number;
    status: string;
    title: string;
    contentMarkdown: string;
    payload: unknown;
    provenance: unknown;
    unsupportedClaims: string[];
    generationVersion: string;
    approvedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: d.id,
      applicationId: d.applicationId,
      type: d.type,
      versionNumber: d.versionNumber,
      status: d.status,
      title: d.title,
      contentMarkdown: d.contentMarkdown,
      payload: d.payload,
      provenance: d.provenance,
      unsupportedClaims: d.unsupportedClaims,
      generationVersion: d.generationVersion,
      approvedAt: d.approvedAt?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    };
  }
}

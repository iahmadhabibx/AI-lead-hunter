import { Inject, Injectable } from '@nestjs/common';
import { AccountDeleteRequestSchema } from '@aijh/contracts';
import {
  auditEvents,
  backgroundTasks,
  users,
  withTenantContext,
} from '@aijh/database';
import { and, desc, eq } from 'drizzle-orm';
import { readFile } from 'node:fs/promises';
import { AppHttpException } from '../common/app-http.exception';
import { DatabaseService } from '../database/database.service';
import { QueueService } from '../queue/queue.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class AccountService {
  constructor(
    @Inject(DatabaseService) private readonly dbService: DatabaseService,
    @Inject(QueueService) private readonly queues: QueueService,
    @Inject(StorageService) private readonly storage: StorageService,
  ) {}

  async requestExport(userId: string) {
    return withTenantContext(this.dbService.db, userId, async (tx) => {
      const [task] = await tx
        .insert(backgroundTasks)
        .values({
          userId,
          type: 'account.export',
          status: 'queued',
          payload: {},
        })
        .returning();
      if (!task) {
        throw new AppHttpException(
          'INTERNAL_ERROR',
          'Failed to create export task',
        );
      }

      await tx.insert(auditEvents).values({
        userId,
        action: 'account.export.requested',
        resourceType: 'user',
        resourceId: userId,
      });

      await this.queues.enqueueAccountExport({
        userId,
        taskId: task.id,
      });

      return {
        taskId: task.id,
        status: 'queued' as const,
        note: 'Export is queued. Poll /tasks/:id; when succeeded, download via GET /account/export/download.',
      };
    });
  }

  async downloadLatestExport(userId: string): Promise<{
    filename: string;
    mimeType: string;
    body: Buffer;
  }> {
    return withTenantContext(this.dbService.db, userId, async (tx) => {
      const exports = await tx.query.backgroundTasks.findMany({
        where: and(
          eq(backgroundTasks.userId, userId),
          eq(backgroundTasks.type, 'account.export'),
          eq(backgroundTasks.status, 'succeeded'),
        ),
        orderBy: [desc(backgroundTasks.createdAt)],
        limit: 5,
      });
      const latest = exports[0];
      const exportPath = (latest?.result as { exportPath?: string } | null)
        ?.exportPath;
      if (!latest || !exportPath) {
        throw new AppHttpException(
          'NOT_FOUND',
          'No completed account export found. Request POST /account/export first.',
        );
      }
      const absolute = this.storage.resolveAbsolute(exportPath);
      const body = await readFile(absolute);
      return {
        filename: `account-export-${latest.id}.json`,
        mimeType: 'application/json; charset=utf-8',
        body,
      };
    });
  }

  async requestDelete(userId: string, email: string, raw: unknown) {
    const body = AccountDeleteRequestSchema.parse(raw);
    if (body.confirmEmail.toLowerCase() !== email.toLowerCase()) {
      throw new AppHttpException(
        'VALIDATION_ERROR',
        'confirmEmail must match the authenticated account email',
      );
    }

    return withTenantContext(this.dbService.db, userId, async (tx) => {
      await this.dbService.db
        .update(users)
        .set({ status: 'pending_deletion', updatedAt: new Date() })
        .where(eq(users.id, userId));

      const [task] = await tx
        .insert(backgroundTasks)
        .values({
          userId,
          type: 'account.delete',
          status: 'queued',
          payload: { confirmEmail: body.confirmEmail },
        })
        .returning();

      if (!task) {
        throw new AppHttpException(
          'INTERNAL_ERROR',
          'Failed to create delete task',
        );
      }

      await tx.insert(auditEvents).values({
        userId,
        action: 'account.delete.requested',
        resourceType: 'user',
        resourceId: userId,
      });

      await this.queues.enqueueAccountDelete({
        userId,
        taskId: task.id,
      });

      return {
        taskId: task.id,
        status: 'queued' as const,
        note: 'Account deletion queued. Sessions will stop working after the worker completes. This cannot be undone.',
      };
    });
  }
}

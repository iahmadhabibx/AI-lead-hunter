import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  assertUploadSize,
  detectCvFormat,
  UnsafeCvFileError,
} from '@aijh/cv-processing';
import {
  backgroundTasks,
  cvDocuments,
  withTenantContext,
} from '@aijh/database';
import { and, eq } from 'drizzle-orm';
import { AppHttpException } from '../common/app-http.exception';
import { ConfigService } from '../config/config.service';
import { DatabaseService } from '../database/database.service';
import { QueueService } from '../queue/queue.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class CvService {
  constructor(
    @Inject(DatabaseService) private readonly dbService: DatabaseService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(StorageService) private readonly storage: StorageService,
    @Inject(QueueService) private readonly queues: QueueService,
  ) {}

  async upload(input: {
    userId: string;
    originalFilename: string;
    buffer: Buffer;
    idempotencyKey?: string;
  }): Promise<{ documentId: string; taskId: string; status: 'uploaded' }> {
    try {
      assertUploadSize(
        input.buffer.byteLength,
        this.config.env.MAX_UPLOAD_BYTES,
      );
      const format = detectCvFormat(input.buffer);

      const documentId = randomUUID();
      const contentHash = this.storage.hashBuffer(input.buffer);
      const { storagePath } = await this.storage.saveCvFile({
        userId: input.userId,
        documentId,
        format,
        buffer: input.buffer,
      });

      const result = await withTenantContext(
        this.dbService.db,
        input.userId,
        async (tx) => {
          if (input.idempotencyKey) {
            const existing = await tx.query.backgroundTasks.findFirst({
              where: and(
                eq(backgroundTasks.userId, input.userId),
                eq(backgroundTasks.idempotencyKey, input.idempotencyKey),
              ),
            });
            if (existing) {
              const docId = (existing.payload as { documentId?: string })
                .documentId;
              if (docId) {
                return {
                  documentId: docId,
                  taskId: existing.id,
                  status: 'uploaded' as const,
                  enqueued: false,
                };
              }
            }
          }

          const [doc] = await tx
            .insert(cvDocuments)
            .values({
              id: documentId,
              userId: input.userId,
              originalFilename: input.originalFilename.slice(0, 255),
              detectedFormat: format,
              sizeBytes: input.buffer.byteLength,
              contentHash,
              storagePath,
              status: 'uploaded',
            })
            .returning();

          if (!doc) {
            throw new AppHttpException(
              'INTERNAL_ERROR',
              'Failed to persist CV document',
            );
          }

          const [task] = await tx
            .insert(backgroundTasks)
            .values({
              userId: input.userId,
              type: 'cv.process',
              status: 'queued',
              payload: { documentId: doc.id },
              idempotencyKey: input.idempotencyKey ?? null,
            })
            .returning();

          if (!task) {
            throw new AppHttpException(
              'INTERNAL_ERROR',
              'Failed to create processing task',
            );
          }

          return {
            documentId: doc.id,
            taskId: task.id,
            status: 'uploaded' as const,
            enqueued: true,
          };
        },
      );

      if (result.enqueued) {
        await this.queues.enqueueCvProcess({
          userId: input.userId,
          documentId: result.documentId,
          taskId: result.taskId,
        });
      }

      return {
        documentId: result.documentId,
        taskId: result.taskId,
        status: result.status,
      };
    } catch (err) {
      if (err instanceof UnsafeCvFileError) {
        throw new AppHttpException('VALIDATION_ERROR', err.message);
      }
      throw err;
    }
  }

  async getDocument(userId: string, documentId: string) {
    return withTenantContext(this.dbService.db, userId, async (tx) => {
      const doc = await tx.query.cvDocuments.findFirst({
        where: and(
          eq(cvDocuments.id, documentId),
          eq(cvDocuments.userId, userId),
        ),
      });
      if (!doc) {
        throw new AppHttpException('NOT_FOUND', 'CV document not found');
      }
      return {
        id: doc.id,
        originalFilename: doc.originalFilename,
        detectedFormat: doc.detectedFormat,
        sizeBytes: doc.sizeBytes,
        status: doc.status,
        errorMessage: doc.errorMessage,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
      };
    });
  }
}

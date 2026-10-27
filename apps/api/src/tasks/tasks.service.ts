import { Inject, Injectable } from '@nestjs/common';
import { backgroundTasks, withTenantContext } from '@aijh/database';
import { and, eq } from 'drizzle-orm';
import { AppHttpException } from '../common/app-http.exception';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class TasksService {
  constructor(
    @Inject(DatabaseService) private readonly dbService: DatabaseService,
  ) {}

  async getTask(userId: string, taskId: string) {
    return withTenantContext(this.dbService.db, userId, async (tx) => {
      const task = await tx.query.backgroundTasks.findFirst({
        where: and(
          eq(backgroundTasks.id, taskId),
          eq(backgroundTasks.userId, userId),
        ),
      });
      if (!task) {
        throw new AppHttpException('NOT_FOUND', 'Task not found');
      }
      return {
        id: task.id,
        type: task.type,
        status: task.status,
        errorMessage: task.errorMessage,
        result: task.result,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
      };
    });
  }
}

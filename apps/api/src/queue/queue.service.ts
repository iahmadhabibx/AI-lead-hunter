import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { ConfigService } from '../config/config.service';

export const CV_PROCESS_QUEUE = 'cv-process';

export type CvProcessJobData = {
  userId: string;
  documentId: string;
  taskId: string;
};

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly connection: IORedis;
  readonly cvProcessQueue: Queue<CvProcessJobData>;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.connection = new IORedis(config.env.REDIS_URL, {
      maxRetriesPerRequest: null,
    });
    this.cvProcessQueue = new Queue<CvProcessJobData>(CV_PROCESS_QUEUE, {
      connection: this.connection,
    });
  }

  async enqueueCvProcess(data: CvProcessJobData): Promise<string> {
    const job = await this.cvProcessQueue.add('process', data, {
      jobId: data.taskId,
      removeOnComplete: 100,
      removeOnFail: 200,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
    return String(job.id);
  }

  async onModuleDestroy(): Promise<void> {
    await this.cvProcessQueue.close();
    await this.connection.quit();
  }
}

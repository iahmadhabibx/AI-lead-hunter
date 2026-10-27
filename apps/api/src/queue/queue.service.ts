import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { ConfigService } from '../config/config.service';

export const CV_PROCESS_QUEUE = 'cv-process';
export const JOBS_DISCOVER_QUEUE = 'jobs-discover';

export type CvProcessJobData = {
  userId: string;
  documentId: string;
  taskId: string;
};

export type JobsDiscoverJobData = {
  sourceKey?: string;
  triggeredBy?: string;
  taskId?: string;
};

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly connection: IORedis;
  readonly cvProcessQueue: Queue<CvProcessJobData>;
  readonly jobsDiscoverQueue: Queue<JobsDiscoverJobData>;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.connection = new IORedis(config.env.REDIS_URL, {
      maxRetriesPerRequest: null,
    });
    this.cvProcessQueue = new Queue<CvProcessJobData>(CV_PROCESS_QUEUE, {
      connection: this.connection,
    });
    this.jobsDiscoverQueue = new Queue<JobsDiscoverJobData>(
      JOBS_DISCOVER_QUEUE,
      { connection: this.connection },
    );
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

  async enqueueJobsDiscover(data: JobsDiscoverJobData): Promise<string> {
    const job = await this.jobsDiscoverQueue.add('discover', data, {
      removeOnComplete: 100,
      removeOnFail: 200,
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 },
    });
    return String(job.id);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([
      this.cvProcessQueue.close(),
      this.jobsDiscoverQueue.close(),
    ]);
    await this.connection.quit();
  }
}

import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import type { DocumentType } from '@aijh/contracts';
import { ConfigService } from '../config/config.service';

export const CV_PROCESS_QUEUE = 'cv-process';
export const JOBS_DISCOVER_QUEUE = 'jobs-discover';
export const JOBS_MATCH_QUEUE = 'jobs-match';
export const DOCS_GENERATE_QUEUE = 'docs-generate';
export const ACCOUNT_EXPORT_QUEUE = 'account-export';
export const ACCOUNT_DELETE_QUEUE = 'account-delete';

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

export type JobsMatchJobData = {
  userId: string;
  taskId?: string;
  canonicalJobIds?: string[];
  limit?: number;
};

export type DocsGenerateJobData = {
  userId: string;
  taskId?: string;
  applicationId: string;
  types?: DocumentType[];
};

export type AccountExportJobData = {
  userId: string;
  taskId: string;
};

export type AccountDeleteJobData = {
  userId: string;
  taskId: string;
};

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly connection: IORedis;
  readonly cvProcessQueue: Queue<CvProcessJobData>;
  readonly jobsDiscoverQueue: Queue<JobsDiscoverJobData>;
  readonly jobsMatchQueue: Queue<JobsMatchJobData>;
  readonly docsGenerateQueue: Queue<DocsGenerateJobData>;
  readonly accountExportQueue: Queue<AccountExportJobData>;
  readonly accountDeleteQueue: Queue<AccountDeleteJobData>;

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
    this.jobsMatchQueue = new Queue<JobsMatchJobData>(JOBS_MATCH_QUEUE, {
      connection: this.connection,
    });
    this.docsGenerateQueue = new Queue<DocsGenerateJobData>(
      DOCS_GENERATE_QUEUE,
      { connection: this.connection },
    );
    this.accountExportQueue = new Queue<AccountExportJobData>(
      ACCOUNT_EXPORT_QUEUE,
      { connection: this.connection },
    );
    this.accountDeleteQueue = new Queue<AccountDeleteJobData>(
      ACCOUNT_DELETE_QUEUE,
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

  async enqueueJobsMatch(data: JobsMatchJobData): Promise<string> {
    const job = await this.jobsMatchQueue.add('match', data, {
      jobId: data.taskId,
      removeOnComplete: 100,
      removeOnFail: 200,
      attempts: 2,
      backoff: { type: 'exponential', delay: 3000 },
    });
    return String(job.id);
  }

  async enqueueDocsGenerate(data: DocsGenerateJobData): Promise<string> {
    const job = await this.docsGenerateQueue.add('generate', data, {
      jobId: data.taskId,
      removeOnComplete: 100,
      removeOnFail: 200,
      attempts: 2,
      backoff: { type: 'exponential', delay: 3000 },
    });
    return String(job.id);
  }

  async enqueueAccountExport(data: AccountExportJobData): Promise<string> {
    const job = await this.accountExportQueue.add('export', data, {
      jobId: data.taskId,
      removeOnComplete: 50,
      removeOnFail: 100,
      attempts: 2,
      backoff: { type: 'exponential', delay: 3000 },
    });
    return String(job.id);
  }

  async enqueueAccountDelete(data: AccountDeleteJobData): Promise<string> {
    const job = await this.accountDeleteQueue.add('delete', data, {
      jobId: data.taskId,
      removeOnComplete: 50,
      removeOnFail: 100,
      attempts: 1,
    });
    return String(job.id);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([
      this.cvProcessQueue.close(),
      this.jobsDiscoverQueue.close(),
      this.jobsMatchQueue.close(),
      this.docsGenerateQueue.close(),
      this.accountExportQueue.close(),
      this.accountDeleteQueue.close(),
    ]);
    await this.connection.quit();
  }
}

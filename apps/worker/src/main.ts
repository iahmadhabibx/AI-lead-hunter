import { parseAppEnv, resolveStorageRoot } from '@aijh/contracts';
import { createLogger } from '@aijh/observability';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { handleCvProcessJob, type CvProcessJobData } from './cv-process';
import {
  handleJobsDiscover,
  type JobsDiscoverJobData,
} from './job-ingest';
import { handleJobsMatch, type JobsMatchJobData } from './match-jobs';
import { handleDocsGenerate, type DocsGenerateJobData } from './docs-generate';
import {
  handleAccountDelete,
  handleAccountExport,
  type AccountDeleteJobData,
  type AccountExportJobData,
} from './account-jobs';

const CV_PROCESS_QUEUE = 'cv-process';
const JOBS_DISCOVER_QUEUE = 'jobs-discover';
const JOBS_MATCH_QUEUE = 'jobs-match';
const DOCS_GENERATE_QUEUE = 'docs-generate';
const ACCOUNT_EXPORT_QUEUE = 'account-export';
const ACCOUNT_DELETE_QUEUE = 'account-delete';

async function main() {
  const env = parseAppEnv(process.env);
  const logger = createLogger({ name: 'worker', level: env.LOG_LEVEL });

  const connection = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });

  connection.on('error', (err) => {
    logger.error({ err }, 'Redis connection error');
  });

  const heartbeatQueue = new Queue('heartbeat', { connection });
  await heartbeatQueue.add(
    'tick',
    { at: new Date().toISOString() },
    {
      removeOnComplete: 20,
      removeOnFail: 50,
      repeat: { every: 60_000 },
    },
  );

  const jobsDiscoverQueue = new Queue<JobsDiscoverJobData>(JOBS_DISCOVER_QUEUE, {
    connection,
  });
  // Periodic discovery when sources are configured; no-op if JOB_SOURCES_JSON empty.
  await jobsDiscoverQueue.add(
    'discover-all',
    { triggeredBy: 'schedule' },
    {
      jobId: 'discover-all-repeat',
      removeOnComplete: 20,
      removeOnFail: 50,
      repeat: { every: 60 * 60 * 1000 },
    },
  );

  const heartbeatWorker = new Worker(
    'heartbeat',
    async (job) => {
      logger.debug({ jobId: job.id }, 'Heartbeat');
      return { ok: true };
    },
    { connection },
  );

  const cvWorker = new Worker<CvProcessJobData>(
    CV_PROCESS_QUEUE,
    async (job) => {
      logger.info(
        { jobId: job.id, documentId: job.data.documentId },
        'Processing CV job',
      );
      await handleCvProcessJob({ env, logger, data: job.data });
      return { ok: true };
    },
    { connection, concurrency: 2 },
  );

  const jobsWorker = new Worker<JobsDiscoverJobData>(
    JOBS_DISCOVER_QUEUE,
    async (job) => {
      logger.info({ jobId: job.id, data: job.data }, 'Running job discovery');
      const result = await handleJobsDiscover({
        env,
        logger,
        data: job.data,
      });
      return result;
    },
    { connection, concurrency: env.JOB_INGEST_CONCURRENCY },
  );

  const matchWorker = new Worker<JobsMatchJobData>(
    JOBS_MATCH_QUEUE,
    async (job) => {
      logger.info({ jobId: job.id, data: job.data }, 'Running job matching');
      return handleJobsMatch({ env, logger, data: job.data });
    },
    { connection, concurrency: 2 },
  );

  const docsWorker = new Worker<DocsGenerateJobData>(
    DOCS_GENERATE_QUEUE,
    async (job) => {
      logger.info({ jobId: job.id, data: job.data }, 'Generating application drafts');
      return handleDocsGenerate({ env, logger, data: job.data });
    },
    { connection, concurrency: 2 },
  );

  const accountExportWorker = new Worker<AccountExportJobData>(
    ACCOUNT_EXPORT_QUEUE,
    async (job) => {
      logger.info({ jobId: job.id }, 'Exporting account data');
      return handleAccountExport({ env, logger, data: job.data });
    },
    { connection, concurrency: 1 },
  );

  const accountDeleteWorker = new Worker<AccountDeleteJobData>(
    ACCOUNT_DELETE_QUEUE,
    async (job) => {
      logger.info({ jobId: job.id }, 'Deleting account');
      return handleAccountDelete({ env, logger, data: job.data });
    },
    { connection, concurrency: 1 },
  );

  cvWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'CV job failed');
  });
  jobsWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Jobs discover failed');
  });
  matchWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Jobs match failed');
  });
  docsWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Docs generate failed');
  });
  accountExportWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Account export failed');
  });
  accountDeleteWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Account delete failed');
  });

  logger.info(
    { storageRoot: resolveStorageRoot(env.STORAGE_ROOT) },
    'Worker started (cv, discover, match, docs, account export/delete)',
  );

  const shutdown = async () => {
    logger.info('Shutting down worker');
    await Promise.all([
      heartbeatWorker.close(),
      cvWorker.close(),
      jobsWorker.close(),
      matchWorker.close(),
      docsWorker.close(),
      accountExportWorker.close(),
      accountDeleteWorker.close(),
      heartbeatQueue.close(),
      jobsDiscoverQueue.close(),
    ]);
    await connection.quit();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

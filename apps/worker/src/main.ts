import { parseAppEnv } from '@aijh/contracts';
import { createLogger } from '@aijh/observability';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { handleCvProcessJob, type CvProcessJobData } from './cv-process';

const CV_PROCESS_QUEUE = 'cv-process';

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

  cvWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'CV job failed');
  });

  logger.info('Worker started (heartbeat + cv-process)');

  const shutdown = async () => {
    logger.info('Shutting down worker');
    await Promise.all([
      heartbeatWorker.close(),
      cvWorker.close(),
      heartbeatQueue.close(),
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

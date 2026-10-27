import { parseAppEnv } from '@aijh/contracts';
import { createLogger } from '@aijh/observability';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

async function main() {
  const env = parseAppEnv(process.env);
  const logger = createLogger({ name: 'worker', level: env.LOG_LEVEL });

  const connection = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });

  connection.on('error', (err) => {
    logger.error({ err }, 'Redis connection error');
  });

  // Phase 0: bootstrap queue + heartbeat worker only. Domain jobs arrive in later phases.
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

  const worker = new Worker(
    'heartbeat',
    async (job) => {
      logger.info({ jobId: job.id, name: job.name }, 'Heartbeat job processed');
      return { ok: true };
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Heartbeat job failed');
  });

  logger.info('Worker started (heartbeat queue)');

  const shutdown = async () => {
    logger.info('Shutting down worker');
    await worker.close();
    await heartbeatQueue.close();
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

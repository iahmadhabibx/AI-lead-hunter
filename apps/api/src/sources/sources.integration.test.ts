import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { createLogger } from '@aijh/observability';
import { parseAppEnv } from '@aijh/contracts';
import { createDb, canonicalJobs, sourceJobs } from '@aijh/database';
import { eq } from 'drizzle-orm';
import { AppModule } from '../app.module';
import { AllExceptionsFilter } from '../common/all-exceptions.filter';
import { handleJobsDiscover } from '../../../worker/src/job-ingest';
import type { FetchJson } from '@aijh/job-connectors';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.REDIS_URL);

describe.runIf(hasDb)('job sources integration', () => {
  let app: INestApplication;
  const email = `jobs-${Date.now()}@example.com`;
  const password = 'correct-horse-battery';

  beforeAll(async () => {
    process.env.APP_URL ??= 'http://localhost:3000';
    process.env.API_URL ??= 'http://localhost:3001';
    process.env.SESSION_SECRET ??= 'test-session-secret-at-least-32-chars';
    process.env.AI_PROVIDER ??= 'mock';
    // Empty by default for status endpoint tests
    process.env.JOB_SOURCES_JSON ??= '[]';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalFilters(
      new AllExceptionsFilter(
        createLogger({ name: 'api-test', level: 'error' }),
      ),
    );
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('reports configured sources without inventing catalog jobs', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/v1/auth/register')
      .send({ email, password, displayName: 'Jobs Tester' });

    const status = await agent.get('/api/v1/sources');
    expect(status.status).toBe(200);
    expect(status.body.catalog.note).toMatch(/not global search/i);
    expect(Array.isArray(status.body.sources)).toBe(true);

    const jobs = await agent.get('/api/v1/sources/jobs');
    expect(jobs.status).toBe(200);
    expect(jobs.body.note).toMatch(/Empty list means/i);
  });

  it('ingests fixture Greenhouse payload idempotently via mock transport', async () => {
    const sourceKey = `gh-fixture-${Date.now()}`;
    process.env.JOB_SOURCES_JSON = JSON.stringify([
      {
        type: 'greenhouse',
        key: sourceKey,
        boardToken: 'fixtureboard',
        enabled: true,
        displayName: 'Fixture Board',
      },
    ]);

    const fixtureJob = {
      id: 424242,
      title: 'Fixture Engineer',
      absolute_url: 'https://boards.greenhouse.io/fixtureboard/jobs/424242',
      location: { name: 'Remote' },
      content: '<p>Build reliable systems</p>',
      departments: [{ name: 'Engineering' }],
      offices: [{ name: 'Remote' }],
      updated_at: '2024-01-01T00:00:00Z',
    };

    const fetchJson: FetchJson = async (url) => {
      if (url.includes('/jobs/') && !url.endsWith('/jobs') && !url.includes('content=true')) {
        return {
          status: 200,
          ok: true,
          headers: new Headers(),
          json: fixtureJob,
        };
      }
      return {
        status: 200,
        ok: true,
        headers: new Headers(),
        json: { jobs: [fixtureJob], meta: { total: 1 } },
      };
    };

    const env = parseAppEnv(process.env);
    const logger = createLogger({ name: 'ingest-test', level: 'error' });

    const first = await handleJobsDiscover({
      env,
      logger,
      data: { sourceKey },
      fetchJson,
    });
    expect(first.upserted).toBe(1);

    const second = await handleJobsDiscover({
      env,
      logger,
      data: { sourceKey },
      fetchJson,
    });
    expect(second.upserted).toBe(1);

    const db = createDb(env.DATABASE_URL);
    const canonical = await db.query.canonicalJobs.findMany({
      where: eq(canonicalJobs.title, 'Fixture Engineer'),
    });
    expect(canonical.length).toBeGreaterThanOrEqual(1);

    const sources = await db.query.sourceJobs.findMany({
      where: eq(sourceJobs.sourceJobId, '424242'),
    });
    expect(sources.length).toBeGreaterThanOrEqual(1);
    expect(sources[0]?.status).toBe('active');
  });
});

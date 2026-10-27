import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseAppEnv } from '@aijh/contracts';
import { createLogger } from '@aijh/observability';
import { AppModule } from '../app.module';
import { AllExceptionsFilter } from '../common/all-exceptions.filter';
import { handleCvProcessJob } from '../../../worker/src/cv-process';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.REDIS_URL);

describe.runIf(hasDb)('CV onboarding integration', () => {
  let app: INestApplication;
  const email = `cv-${Date.now()}@example.com`;
  const password = 'correct-horse-battery';
  const docxPath = path.resolve(
    __dirname,
    '../../../../tests/fixtures/sample-cv.docx',
  );

  beforeAll(async () => {
    process.env.AI_PROVIDER = 'mock';
    process.env.APP_URL ??= 'http://localhost:3000';
    process.env.API_URL ??= 'http://localhost:3001';
    process.env.SESSION_SECRET ??= 'test-session-secret-at-least-32-chars';

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

  it('uploads, processes with mock AI, reviews, and approves', async () => {
    const agent = request.agent(app.getHttpServer());
    const docx = readFileSync(docxPath);

    const register = await agent
      .post('/api/v1/auth/register')
      .send({ email, password, displayName: 'CV Tester' });
    expect(register.status).toBe(200);

    const upload = await agent
      .post('/api/v1/cv/uploads')
      .attach('file', docx, 'sample-cv.docx');
    expect(upload.status).toBe(201);
    expect(upload.body.documentId).toBeTruthy();
    expect(upload.body.taskId).toBeTruthy();

    const env = parseAppEnv(process.env);
    await handleCvProcessJob({
      env,
      logger: createLogger({ name: 'worker-test', level: 'error' }),
      data: {
        userId: register.body.user.id,
        documentId: upload.body.documentId,
        taskId: upload.body.taskId,
      },
    });

    const task = await agent.get(`/api/v1/tasks/${upload.body.taskId}`);
    expect(task.status).toBe(200);
    expect(task.body.status).toBe('succeeded');

    const doc = await agent.get(
      `/api/v1/cv/documents/${upload.body.documentId}`,
    );
    expect(doc.body.status).toBe('extracted');

    const profile = await agent.get('/api/v1/profile');
    expect(profile.status).toBe(200);
    expect(profile.body.pendingVersion).toBeTruthy();
    const draft = profile.body.pendingVersion.payload;
    expect(draft.schemaVersion).toBe('1.0.0');

    draft.identity.fullName = 'Ada Lovelace (corrected)';
    const saved = await agent.patch('/api/v1/profile/draft').send(draft);
    expect(saved.status).toBe(200);
    expect(saved.body.payload.identity.fullName).toBe(
      'Ada Lovelace (corrected)',
    );

    const approved = await agent.post('/api/v1/profile/approve');
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe('approved');
    expect(approved.body.approvedAt).toBeTruthy();

    const after = await agent.get('/api/v1/profile');
    expect(after.body.activeVersion?.id).toBe(approved.body.id);
    expect(after.body.pendingVersion).toBeNull();

    // Reject clearly invalid upload
    const bad = await agent
      .post('/api/v1/cv/uploads')
      .attach('file', Buffer.from('not-a-cv'), 'notes.txt');
    expect(bad.status).toBe(400);
  });
});

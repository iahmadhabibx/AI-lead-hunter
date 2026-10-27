import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../app.module';
import { AllExceptionsFilter } from '../common/all-exceptions.filter';
import { createLogger } from '@aijh/observability';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.REDIS_URL);

describe.runIf(hasDb)('auth integration', () => {
  let app: INestApplication;
  const email = `user-${Date.now()}@example.com`;
  const password = 'correct-horse-battery';

  beforeAll(async () => {
    process.env.APP_URL ??= 'http://localhost:3000';
    process.env.API_URL ??= 'http://localhost:3001';
    process.env.SESSION_SECRET ??= 'test-session-secret-at-least-32-chars';
    process.env.AI_PROVIDER ??= 'mock';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalFilters(new AllExceptionsFilter(createLogger({ name: 'api-test', level: 'error' })));
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('registers, reads me, and logs out', async () => {
    const agent = request.agent(app.getHttpServer());

    const register = await agent
      .post('/api/v1/auth/register')
      .send({ email, password, displayName: 'Test User' });
    expect(register.status).toBe(200);
    expect(register.body.user.email).toBe(email);

    const me = await agent.get('/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(email);

    const logout = await agent.post('/api/v1/auth/logout');
    expect(logout.status).toBe(200);

    const meAfter = await agent.get('/api/v1/auth/me');
    expect(meAfter.status).toBe(401);
  });
});

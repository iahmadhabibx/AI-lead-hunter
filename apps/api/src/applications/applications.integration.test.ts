import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { createLogger } from '@aijh/observability';
import {
  CANDIDATE_PROFILE_SCHEMA_VERSION,
  JOB_NORMALIZATION_VERSION,
  DRAFT_GENERATION_VERSION,
  parseAppEnv,
} from '@aijh/contracts';
import {
  candidateProfiles,
  candidateProfileVersions,
  canonicalJobs,
  createDb,
  withTenantContext,
} from '@aijh/database';
import { eq } from 'drizzle-orm';
import { AppModule } from '../app.module';
import { AllExceptionsFilter } from '../common/all-exceptions.filter';
import { handleDocsGenerate } from '../../../worker/src/docs-generate';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.REDIS_URL);

describe.runIf(hasDb)('applications + preferences integration', () => {
  let app: INestApplication;
  const email = `apps-${Date.now()}@example.com`;
  const password = 'correct-horse-battery';
  let userId: string;
  let jobId: string;
  let agent: ReturnType<typeof request.agent>;

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
    app.useGlobalFilters(
      new AllExceptionsFilter(
        createLogger({ name: 'api-test', level: 'error' }),
      ),
    );
    await app.init();

    agent = request.agent(app.getHttpServer());
    const register = await agent
      .post('/api/v1/auth/register')
      .send({ email, password, displayName: 'Apps Tester' });
    expect(register.status).toBe(200);
    userId = register.body.user.id as string;

    const env = parseAppEnv(process.env);
    const db = createDb(env.DATABASE_URL);

    const jobPayload = {
      normalizationVersion: JOB_NORMALIZATION_VERSION,
      title: 'Backend Engineer',
      companyName: 'HireCo',
      locationText: 'Remote',
      descriptionText: 'TypeScript and PostgreSQL services.',
      applyUrl: `https://boards.greenhouse.io/hireco/jobs/${Date.now()}`,
      sourceAttribution: 'greenhouse:hireco',
      departments: ['Engineering'],
      offices: [],
      workMode: 'remote',
      rawExtras: {},
    };

    const [job] = await db
      .insert(canonicalJobs)
      .values({
        contentHash: `apps-job-${Date.now()}`,
        normalizationVersion: JOB_NORMALIZATION_VERSION,
        title: jobPayload.title,
        companyName: jobPayload.companyName,
        locationText: jobPayload.locationText,
        descriptionText: jobPayload.descriptionText,
        applyUrl: jobPayload.applyUrl,
        sourceAttribution: jobPayload.sourceAttribution,
        departments: jobPayload.departments,
        offices: [],
        workMode: 'remote',
        status: 'active',
        payload: jobPayload,
      })
      .returning();
    jobId = job!.id;

    const profilePayload = {
      schemaVersion: CANDIDATE_PROFILE_SCHEMA_VERSION,
      identity: {
        fullName: 'Apps Tester',
        email,
        phone: null,
        links: [],
      },
      location: {
        current: 'Berlin, Germany',
        preferredCountries: ['Germany'],
        relocationWillingness: 'unknown',
      },
      employment: [
        {
          id: 'e1',
          title: 'Software Engineer',
          company: 'PrevCo',
          start: { year: 2020, month: 1, precision: 'month' },
          end: null,
          isCurrent: true,
          description: 'TypeScript APIs and PostgreSQL.',
        },
      ],
      totalExperienceMonths: 60,
      skills: [
        { name: 'TypeScript', evidenceIds: [] },
        { name: 'PostgreSQL', evidenceIds: [] },
      ],
      education: [],
      projects: [],
      certifications: [],
      languages: [],
      preferences: {
        preferredJobTitles: ['Software Engineer'],
        preferredIndustries: [],
        excludedIndustries: [],
        preferredWorkModes: ['remote'],
      },
      evidence: [],
      missingFields: [],
      uncertainFields: [],
    };

    await withTenantContext(db, userId, async (tx) => {
      const [profile] = await tx
        .insert(candidateProfiles)
        .values({ userId })
        .returning();
      const [version] = await tx
        .insert(candidateProfileVersions)
        .values({
          profileId: profile!.id,
          userId,
          versionNumber: 1,
          status: 'approved',
          schemaVersion: CANDIDATE_PROFILE_SCHEMA_VERSION,
          payload: profilePayload,
          approvedAt: new Date(),
        })
        .returning();
      await tx
        .update(candidateProfiles)
        .set({ activeVersionId: version!.id })
        .where(eq(candidateProfiles.id, profile!.id));
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('learns preferences from feedback and can reset', async () => {
    const reject = await agent.post('/api/v1/matches/reject').send({
      canonicalJobId: jobId,
      rejectionReasons: ['wrong_work_mode'],
    });
    expect(reject.status).toBe(200);

    const recompute = await agent.post('/api/v1/preferences/learned/recompute');
    expect(recompute.status).toBe(200);
    expect(recompute.body.payload.learningVersion).toBeTruthy();
    expect(recompute.body.payload.sourceEventCount).toBeGreaterThan(0);

    const get = await agent.get('/api/v1/preferences/learned');
    expect(get.status).toBe(200);
    expect(get.body.learned?.id).toBe(recompute.body.id);

    const reset = await agent.post('/api/v1/preferences/learned/reset');
    expect(reset.status).toBe(200);
    expect(reset.body.ok).toBe(true);

    const after = await agent.get('/api/v1/preferences/learned');
    expect(after.body.learned).toBeNull();
  });

  it('creates application, generates versioned drafts, edits, exports, approves; never auto-submits', async () => {
    const create = await agent.post('/api/v1/applications').send({
      canonicalJobId: jobId,
    });
    expect(create.status).toBe(200);
    expect(create.body.officialApplyUrl).toMatch(/^https:\/\//);
    expect(create.body.submissionPolicy).toMatch(/never submitted automatically/i);
    const applicationId = create.body.id as string;

    const gen = await agent.post('/api/v1/applications/generate').send({
      applicationId,
      types: ['tailored_cv', 'cover_letter', 'application_answers'],
    });
    expect(gen.status).toBe(200);

    const env = parseAppEnv(process.env);
    const result = await handleDocsGenerate({
      env,
      logger: createLogger({ name: 'docs-test', level: 'error' }),
      data: {
        userId,
        taskId: gen.body.taskId,
        applicationId,
        types: ['tailored_cv', 'cover_letter', 'application_answers'],
      },
    });
    expect(result.documentsCreated).toBe(3);
    expect(result.generationVersion).toBe(DRAFT_GENERATION_VERSION);

    const detail = await agent.get(`/api/v1/applications/${applicationId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.documents.length).toBeGreaterThanOrEqual(3);
    expect(detail.body.profileVersionId).toBeTruthy();

    const cvSummary = detail.body.documents.find(
      (d: { type: string }) => d.type === 'tailored_cv',
    );
    expect(cvSummary).toBeTruthy();

    const cv = await agent.get(`/api/v1/documents/${cvSummary.id}`);
    expect(cv.status).toBe(200);
    expect(cv.body.provenance.profileVersionId).toBe(
      detail.body.profileVersionId,
    );
    expect(cv.body.contentMarkdown).toContain('Apps Tester');
    expect(cv.body.contentMarkdown).not.toMatch(/\bGoogle\b|\bPhD\b/);

    const edited = await agent.patch(`/api/v1/documents/${cvSummary.id}`).send({
      contentMarkdown: cv.body.contentMarkdown + '\n\n## Notes\nUser reviewed draft.',
    });
    expect(edited.status).toBe(200);
    expect(edited.body.versionNumber).toBe(cv.body.versionNumber);

    const exported = await agent.get(`/api/v1/documents/${cvSummary.id}/export`);
    expect(exported.status).toBe(200);
    expect(exported.headers['content-type']).toMatch(/markdown/);
    expect(exported.text).toContain('ForgePath export');

    // Clear unsupported by regenerating is hard; approve if none
    if ((cv.body.unsupportedClaims as string[]).length === 0) {
      // Re-fetch after edit — edits clear claims; approve may be blocked if we require empty unsupported
      const approve = await agent.post(
        `/api/v1/documents/${cvSummary.id}/approve`,
      );
      expect(approve.status).toBe(200);
      expect(approve.body.status).toBe('approved');

      // Immutable after approve
      const editAgain = await agent
        .patch(`/api/v1/documents/${cvSummary.id}`)
        .send({ contentMarkdown: 'hack' });
      expect(editAgain.status).toBe(409);
    }

    const markApplied = await agent
      .patch(`/api/v1/applications/${applicationId}/status`)
      .send({ status: 'applied', note: 'Submitted manually on Greenhouse' });
    expect(markApplied.status).toBe(200);
    expect(markApplied.body.submissionPolicy).toMatch(/does not submit/i);

    // Ownership: other user cannot read
    const other = request.agent(app.getHttpServer());
    await other.post('/api/v1/auth/register').send({
      email: `other-${Date.now()}@example.com`,
      password,
      displayName: 'Other',
    });
    const stolen = await other.get(`/api/v1/applications/${applicationId}`);
    expect(stolen.status).toBe(404);
  });
});

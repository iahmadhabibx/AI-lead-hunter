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
  MATCH_SCORING_VERSION,
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
import { handleJobsMatch } from '../../../worker/src/match-jobs';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.REDIS_URL);

describe.runIf(hasDb)('matching + feedback integration', () => {
  let app: INestApplication;
  const email = `match-${Date.now()}@example.com`;
  const password = 'correct-horse-battery';
  let userId: string;
  let jobEligibleId: string;
  let jobIneligibleId: string;
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
      .send({ email, password, displayName: 'Match Tester' });
    expect(register.status).toBe(200);
    userId = register.body.user.id as string;

    const env = parseAppEnv(process.env);
    const db = createDb(env.DATABASE_URL);

    const eligiblePayload = {
      normalizationVersion: JOB_NORMALIZATION_VERSION,
      title: 'Senior Software Engineer',
      companyName: 'MatchCo',
      locationText: 'Berlin, Germany',
      descriptionText:
        'TypeScript, Node.js, PostgreSQL. Hybrid team. Compensation $110,000.',
      applyUrl: `https://boards.greenhouse.io/matchco/jobs/${Date.now()}`,
      sourceAttribution: 'greenhouse:matchco',
      departments: ['Engineering'],
      offices: ['Berlin'],
      workMode: 'hybrid',
      rawExtras: {},
    };

    const ineligiblePayload = {
      ...eligiblePayload,
      title: 'Onsite Casino Engineer',
      locationText: 'Las Vegas, USA',
      descriptionText:
        'Gambling platform. Onsite only. No visa sponsorship. Must have unrestricted work authorization.',
      applyUrl: `https://boards.greenhouse.io/matchco/jobs/${Date.now() + 1}`,
      departments: ['Gambling'],
      workMode: 'onsite',
    };

    const [eligible] = await db
      .insert(canonicalJobs)
      .values({
        contentHash: `match-eligible-${Date.now()}`,
        normalizationVersion: JOB_NORMALIZATION_VERSION,
        title: eligiblePayload.title,
        companyName: eligiblePayload.companyName,
        locationText: eligiblePayload.locationText,
        descriptionText: eligiblePayload.descriptionText,
        applyUrl: eligiblePayload.applyUrl,
        sourceAttribution: eligiblePayload.sourceAttribution,
        departments: eligiblePayload.departments,
        offices: eligiblePayload.offices,
        workMode: 'hybrid',
        status: 'active',
        payload: eligiblePayload,
      })
      .returning();

    const [ineligible] = await db
      .insert(canonicalJobs)
      .values({
        contentHash: `match-ineligible-${Date.now()}`,
        normalizationVersion: JOB_NORMALIZATION_VERSION,
        title: ineligiblePayload.title,
        companyName: ineligiblePayload.companyName,
        locationText: ineligiblePayload.locationText,
        descriptionText: ineligiblePayload.descriptionText,
        applyUrl: ineligiblePayload.applyUrl,
        sourceAttribution: ineligiblePayload.sourceAttribution,
        departments: ineligiblePayload.departments,
        offices: ['Las Vegas'],
        workMode: 'onsite',
        status: 'active',
        payload: ineligiblePayload,
      })
      .returning();

    jobEligibleId = eligible!.id;
    jobIneligibleId = ineligible!.id;

    const profilePayload = {
      schemaVersion: CANDIDATE_PROFILE_SCHEMA_VERSION,
      identity: {
        fullName: 'Match Tester',
        email,
        phone: null,
        links: [],
      },
      location: {
        current: 'Berlin, Germany',
        preferredCountries: ['Germany'],
        relocationWillingness: 'no',
      },
      employment: [
        {
          id: 'e1',
          title: 'Software Engineer',
          company: 'Prev',
          start: { year: 2019, month: 1, precision: 'month' },
          end: null,
          isCurrent: true,
        },
      ],
      totalExperienceMonths: 72,
      skills: [
        { name: 'TypeScript', evidenceIds: [] },
        { name: 'Node.js', evidenceIds: [] },
        { name: 'PostgreSQL', evidenceIds: [] },
      ],
      education: [],
      projects: [],
      certifications: [],
      languages: [],
      preferences: {
        preferredJobTitles: ['Software Engineer'],
        preferredIndustries: ['Software'],
        excludedIndustries: ['Gambling'],
        preferredWorkModes: ['remote', 'hybrid'],
        workAuthorization: { requiresSponsorship: 'yes' },
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

  it('runs matching, persists breakdowns, save/reject with audit feedback', async () => {
    const env = parseAppEnv(process.env);
    const run = await agent.post('/api/v1/matches/run?limit=50');
    expect(run.status).toBe(200);
    expect(run.body.taskId).toBeTruthy();

    const result = await handleJobsMatch({
      env,
      logger: createLogger({ name: 'match-test', level: 'error' }),
      data: {
        userId,
        taskId: run.body.taskId,
        canonicalJobIds: [jobEligibleId, jobIneligibleId],
      },
    });
    expect(result.matched).toBe(2);
    expect(result.scoringVersion).toBe(MATCH_SCORING_VERSION);

    const list = await agent.get('/api/v1/matches');
    expect(list.status).toBe(200);
    expect(list.body.scoringNote).toMatch(/not interview/i);
    expect(list.body.matches.length).toBeGreaterThanOrEqual(2);

    const eligible = list.body.matches.find(
      (m: { canonicalJobId: string }) => m.canonicalJobId === jobEligibleId,
    );
    const blocked = list.body.matches.find(
      (m: { canonicalJobId: string }) => m.canonicalJobId === jobIneligibleId,
    );
    expect(eligible?.band).toBe('needs_verification'); // sponsorship required, unknown/offered not in text
    expect(blocked?.band).toBe('ineligible');

    const detail = await agent.get(`/api/v1/matches/${eligible.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.breakdown.components).toHaveLength(6);
    expect(detail.body.breakdown.hardFilters.length).toBeGreaterThan(0);
    expect(detail.body.scoringVersion).toBe(MATCH_SCORING_VERSION);

    const save = await agent.post('/api/v1/saved-jobs').send({
      canonicalJobId: jobEligibleId,
      matchResultId: eligible.id,
    });
    expect(save.status).toBe(200);

    const saved = await agent.get('/api/v1/saved-jobs');
    expect(saved.status).toBe(200);
    expect(saved.body.saved.some((s: { canonicalJobId: string }) => s.canonicalJobId === jobEligibleId)).toBe(
      true,
    );

    const reject = await agent.post('/api/v1/matches/reject').send({
      canonicalJobId: jobIneligibleId,
      matchResultId: blocked.id,
      rejectionReasons: ['unwanted_industry', 'wrong_work_mode'],
      note: 'Hard constraints violated',
    });
    expect(reject.status).toBe(200);
    expect(reject.body.feedbackEventId).toBeTruthy();

    const feedback = await agent.get('/api/v1/feedback');
    expect(feedback.status).toBe(200);
    const types = feedback.body.events.map((e: { type: string }) => e.type);
    expect(types).toContain('saved');
    expect(types).toContain('rejected');
  });
});

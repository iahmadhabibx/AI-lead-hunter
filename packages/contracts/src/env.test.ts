import { describe, expect, it } from 'vitest';
import { parseAppEnv } from './env';

const valid = {
  NODE_ENV: 'test',
  APP_URL: 'http://localhost:3000',
  API_URL: 'http://localhost:3001',
  SESSION_SECRET: 'x'.repeat(32),
  DATABASE_URL: 'postgres://aijh_app:pass@localhost:5432/aijh',
  REDIS_URL: 'redis://localhost:6379',
};

describe('parseAppEnv', () => {
  it('parses valid env', () => {
    const env = parseAppEnv(valid);
    expect(env.API_PORT).toBe(3001);
    expect(env.AI_PROVIDER).toBe('mock');
  });

  it('rejects short session secret', () => {
    expect(() =>
      parseAppEnv({ ...valid, SESSION_SECRET: 'too-short' }),
    ).toThrow(/SESSION_SECRET/);
  });

  it('rejects missing DATABASE_URL', () => {
    const { DATABASE_URL: _, ...rest } = valid;
    expect(() => parseAppEnv(rest)).toThrow(/DATABASE_URL/);
  });
});

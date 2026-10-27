import { describe, expect, it } from 'vitest';

describe('health response shape', () => {
  it('describes a healthy payload', () => {
    const payload = {
      status: 'ok',
      service: 'ai-job-hunter',
      time: new Date().toISOString(),
    };
    expect(payload.status).toBe('ok');
    expect(payload.time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

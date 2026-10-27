import { describe, expect, it, vi } from 'vitest';
import { GreenhouseConnector } from './greenhouse';
import type { FetchJson } from './types';

describe('GreenhouseConnector', () => {
  it('discovers jobs from fixture JSON without inventing rows', async () => {
    const fetchJson: FetchJson = vi.fn(async () => ({
      status: 200,
      ok: true,
      headers: new Headers(),
      json: {
        jobs: [
          {
            id: 127817,
            title: 'Vault Designer',
            absolute_url: 'https://boards.greenhouse.io/vaulttec/jobs/127817',
          },
        ],
        meta: { total: 1 },
      },
    }));

    const connector = new GreenhouseConnector(
      {
        type: 'greenhouse',
        key: 'vaulttec',
        boardToken: 'vaulttec',
        enabled: true,
      },
      { fetchJson },
    );

    const page = await connector.discover({}, null);
    expect(page.jobs).toHaveLength(1);
    expect(page.jobs[0]?.sourceJobId).toBe('127817');
    expect(page.nextCursor).toBeNull();
    expect(connector.getCapabilities().isGlobalSearch).toBe(false);
  });

  it('returns null for confirmed missing job (404), not closed inventively', async () => {
    const fetchJson: FetchJson = vi.fn(async () => ({
      status: 404,
      ok: false,
      headers: new Headers(),
      json: {},
    }));
    const connector = new GreenhouseConnector(
      {
        type: 'greenhouse',
        key: 'vaulttec',
        boardToken: 'vaulttec',
        enabled: true,
      },
      { fetchJson },
    );
    await expect(connector.fetchJob('missing')).resolves.toBeNull();
  });
});

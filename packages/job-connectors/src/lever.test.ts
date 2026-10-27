import { describe, expect, it, vi } from 'vitest';
import { LeverConnector } from './lever';
import type { FetchJson } from './types';

describe('LeverConnector', () => {
  it('paginates with skip/limit and stops when short page', async () => {
    const fetchJson: FetchJson = vi.fn(async (url) => {
      const u = new URL(url);
      const skip = Number(u.searchParams.get('skip') ?? '0');
      if (skip === 0) {
        return {
          status: 200,
          ok: true,
          headers: new Headers(),
          json: Array.from({ length: 100 }, (_, i) => ({
            id: `id-${i}`,
            text: `Role ${i}`,
            applyUrl: `https://jobs.lever.co/demo/${i}`,
          })),
        };
      }
      return {
        status: 200,
        ok: true,
        headers: new Headers(),
        json: [{ id: 'last', text: 'Last', applyUrl: 'https://jobs.lever.co/demo/last' }],
      };
    });

    const connector = new LeverConnector(
      {
        type: 'lever',
        key: 'demo',
        site: 'leverdemo',
        eu: false,
        enabled: true,
      },
      { fetchJson },
    );

    const first = await connector.discover({}, null);
    expect(first.jobs).toHaveLength(100);
    expect(first.nextCursor?.skip).toBe(100);

    const second = await connector.discover({}, first.nextCursor);
    expect(second.jobs).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
  });
});

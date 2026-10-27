import { describe, expect, it } from 'vitest';
import { parseJobSourcesJson } from './job';

describe('parseJobSourcesJson', () => {
  it('parses an empty/missing config as no sources', () => {
    expect(parseJobSourcesJson(undefined)).toEqual([]);
    expect(parseJobSourcesJson('')).toEqual([]);
  });

  it('parses greenhouse and lever board configs', () => {
    const sources = parseJobSourcesJson(
      JSON.stringify([
        {
          type: 'greenhouse',
          key: 'acme-gh',
          boardToken: 'acme',
          enabled: true,
        },
        {
          type: 'lever',
          key: 'acme-lever',
          site: 'acme',
          eu: false,
          enabled: false,
        },
      ]),
    );
    expect(sources).toHaveLength(2);
    expect(sources[0]?.type).toBe('greenhouse');
    expect(sources[1]?.type).toBe('lever');
    expect(sources[1]?.enabled).toBe(false);
  });
});

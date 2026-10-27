import { describe, expect, it } from 'vitest';
import { parseLinkNext } from './http';

describe('parseLinkNext', () => {
  it('extracts rel=next URL', () => {
    expect(
      parseLinkNext(
        '<https://example.com/page2>; rel="next", <https://example.com/page1>; rel="prev"',
      ),
    ).toBe('https://example.com/page2');
  });
});

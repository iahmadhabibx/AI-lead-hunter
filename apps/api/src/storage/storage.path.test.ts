import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { StorageService } from './storage.service';

describe('StorageService path safety', () => {
  const storage = new StorageService({
    env: {
      STORAGE_ROOT: path.join(process.cwd(), 'tmp-test-storage'),
    },
  } as ConstructorParameters<typeof StorageService>[0]);

  it('rejects path traversal in resolveAbsolute', () => {
    expect(() => storage.resolveAbsolute('../etc/passwd')).toThrow(/Invalid/);
    expect(() => storage.resolveAbsolute('..\\etc\\passwd')).toThrow(/Invalid/);
  });

  it('accepts nested paths under the root', () => {
    const abs = storage.resolveAbsolute('user-id/doc.pdf');
    expect(abs).toContain('user-id');
    expect(abs.endsWith(`doc.pdf`)).toBe(true);
  });
});

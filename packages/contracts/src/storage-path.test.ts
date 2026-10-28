import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { findMonorepoRoot, resolveStorageRoot } from './storage-path';

describe('resolveStorageRoot', () => {
  it('finds the monorepo root from an app package cwd', () => {
    const apiCwd = path.join(findMonorepoRoot(), 'apps', 'api');
    const workerCwd = path.join(findMonorepoRoot(), 'apps', 'worker');
    expect(findMonorepoRoot(apiCwd)).toBe(findMonorepoRoot(workerCwd));
  });

  it('resolves relative STORAGE_ROOT to the same absolute path from api and worker cwds', () => {
    const root = findMonorepoRoot();
    const fromApi = resolveStorageRoot(
      '.local/uploads',
      path.join(root, 'apps', 'api'),
    );
    const fromWorker = resolveStorageRoot(
      '.local/uploads',
      path.join(root, 'apps', 'worker'),
    );
    expect(fromApi).toBe(fromWorker);
    expect(fromApi).toBe(path.resolve(root, '.local/uploads'));
  });

  it('keeps absolute STORAGE_ROOT unchanged', () => {
    const absolute = path.resolve('/tmp/aijh-storage');
    expect(resolveStorageRoot(absolute)).toBe(path.normalize(absolute));
  });
});

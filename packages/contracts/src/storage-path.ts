import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const MONOREPO_PACKAGE_NAME = 'ai-job-hunter';

/**
 * Walk up from `start` until the monorepo root package.json is found.
 * Falls back to `start` when not running inside the monorepo.
 */
export function findMonorepoRoot(start: string = process.cwd()): string {
  let dir = path.resolve(start);
  for (;;) {
    const pkgPath = path.join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
          name?: string;
        };
        if (pkg.name === MONOREPO_PACKAGE_NAME) {
          return dir;
        }
      } catch {
        // ignore unreadable / invalid package.json
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return path.resolve(start);
    }
    dir = parent;
  }
}

/**
 * Resolve STORAGE_ROOT so API and worker share one directory.
 * Absolute paths are used as-is; relative paths are resolved from the monorepo root
 * (not each package's cwd), which prevents apps/api/uploads vs apps/worker/uploads splits.
 */
export function resolveStorageRoot(
  storageRoot: string,
  cwd: string = process.cwd(),
): string {
  if (path.isAbsolute(storageRoot)) {
    return path.normalize(storageRoot);
  }
  return path.resolve(findMonorepoRoot(cwd), storageRoot);
}

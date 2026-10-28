import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ConfigService } from '../config/config.service';

@Injectable()
export class StorageService {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  root(): string {
    return path.resolve(this.config.env.STORAGE_ROOT);
  }

  hashBuffer(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  async saveCvFile(input: {
    userId: string;
    documentId: string;
    format: 'pdf' | 'docx';
    buffer: Buffer;
  }): Promise<{ storagePath: string; absolutePath: string }> {
    const userDir = path.join(this.root(), input.userId);
    await mkdir(userDir, { recursive: true, mode: 0o700 });
    const filename = `${input.documentId}.${input.format}`;
    const absolutePath = path.resolve(userDir, filename);
    const resolvedUserDir = path.resolve(userDir);
    if (
      absolutePath !== resolvedUserDir &&
      !absolutePath.startsWith(resolvedUserDir + path.sep)
    ) {
      throw new Error('Invalid storage path');
    }
    await writeFile(absolutePath, input.buffer, { mode: 0o600 });
    const storagePath = path.posix.join(input.userId, filename);
    return { storagePath, absolutePath };
  }

  resolveAbsolute(storagePath: string): string {
    const root = this.root();
    // Reject absolute / escaped segments before resolve
    if (
      path.isAbsolute(storagePath) ||
      storagePath.split(/[/\\]/).includes('..')
    ) {
      throw new Error('Invalid storage path');
    }
    const absolute = path.resolve(root, storagePath);
    const relative = path.relative(root, absolute);
    if (
      relative.startsWith('..') ||
      path.isAbsolute(relative) ||
      relative === ''
    ) {
      throw new Error('Invalid storage path');
    }
    return absolute;
  }

  async deleteUserTree(userId: string): Promise<void> {
    if (!/^[0-9a-f-]{36}$/i.test(userId)) {
      throw new Error('Invalid user id for storage deletion');
    }
    const userDir = path.resolve(this.root(), userId);
    const relative = path.relative(this.root(), userDir);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Invalid storage path');
    }
    const { rm } = await import('node:fs/promises');
    await rm(userDir, { recursive: true, force: true });
  }
}

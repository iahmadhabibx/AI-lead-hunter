import { randomUUID } from 'node:crypto';

export function createRequestId(existing?: string | null): string {
  if (existing && /^[0-9a-f-]{36}$/i.test(existing)) {
    return existing;
  }
  return randomUUID();
}

import { describe, expect, it } from 'vitest';
import { assertTenantAccess, TenantAccessError } from './tenant';

describe('assertTenantAccess', () => {
  it('allows matching owner', () => {
    expect(() =>
      assertTenantAccess({ userId: 'u1' }, 'u1'),
    ).not.toThrow();
  });

  it('rejects cross-tenant access', () => {
    expect(() => assertTenantAccess({ userId: 'u1' }, 'u2')).toThrow(
      TenantAccessError,
    );
  });
});

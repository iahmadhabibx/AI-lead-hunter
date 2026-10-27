/**
 * Tenant context helpers. Never accept client-supplied user IDs as authority.
 */
export type TenantContext = {
  userId: string;
};

export function assertTenantAccess(
  ctx: TenantContext,
  resourceOwnerId: string,
): void {
  if (ctx.userId !== resourceOwnerId) {
    throw new TenantAccessError();
  }
}

export class TenantAccessError extends Error {
  readonly code = 'FORBIDDEN' as const;

  constructor(message = 'Access denied for this resource') {
    super(message);
    this.name = 'TenantAccessError';
  }
}

/** SQL fragment name for set_config('app.current_user_id', ...) */
export const TENANT_SETTING_KEY = 'app.current_user_id';

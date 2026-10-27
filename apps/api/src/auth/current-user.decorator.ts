import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { UserPublic } from '@aijh/contracts';
import type { Request } from 'express';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserPublic => {
    const req = ctx.switchToHttp().getRequest<Request & { user: UserPublic }>();
    return req.user;
  },
);

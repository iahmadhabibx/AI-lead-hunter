import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { user?: unknown }
    >();
    const token = req.cookies?.[this.auth.cookieName()] as string | undefined;
    const user = await this.auth.resolveUserFromSession(token);
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }
    req.user = user;
    return true;
  }
}

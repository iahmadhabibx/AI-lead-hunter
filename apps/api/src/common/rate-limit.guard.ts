import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { MemoryRateLimiter } from '@aijh/security';
import type { Request, Response } from 'express';
import { AppHttpException } from './app-http.exception';
import { ConfigService } from '../config/config.service';

const globalLimiter = new MemoryRateLimiter();

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const ip = clientIp(req, this.config.env.TRUST_PROXY);
    const key = `auth:${ip}`;
    const result = globalLimiter.check(
      key,
      this.config.env.AUTH_RATE_LIMIT_MAX,
      this.config.env.AUTH_RATE_LIMIT_WINDOW_MS,
    );
    res.setHeader('X-RateLimit-Limit', String(this.config.env.AUTH_RATE_LIMIT_MAX));
    res.setHeader('X-RateLimit-Remaining', String(result.remaining));
    if (!result.allowed) {
      res.setHeader(
        'Retry-After',
        String(Math.ceil(result.retryAfterMs / 1000) || 1),
      );
      throw new AppHttpException(
        'RATE_LIMITED',
        'Too many authentication attempts. Try again later.',
      );
    }
    return true;
  }
}

export function clientIp(req: Request, trustProxy: boolean): string {
  if (trustProxy) {
    const xf = req.headers['x-forwarded-for'];
    if (typeof xf === 'string' && xf.length > 0) {
      return xf.split(',')[0]?.trim() || req.ip || 'unknown';
    }
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/** Test helper */
export function resetAuthRateLimiter(): void {
  globalLimiter.reset();
}

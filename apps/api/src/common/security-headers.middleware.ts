import type { NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/** Minimal security headers without pulling a heavy middleware dependency. */
export class SecurityHeadersMiddleware implements NestMiddleware {
  use(_req: Request, res: Response, next: NextFunction): void {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=()',
    );
    res.setHeader('X-XSS-Protection', '0');
    next();
  }
}

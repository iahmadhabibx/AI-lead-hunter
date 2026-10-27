import { Injectable, NestMiddleware } from '@nestjs/common';
import { createRequestId } from '@aijh/observability';
import type { NextFunction, Request, Response } from 'express';

export type RequestWithId = Request & { requestId?: string };

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: RequestWithId, res: Response, next: NextFunction): void {
    const header = req.header('x-request-id');
    const requestId = createRequestId(header);
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  }
}

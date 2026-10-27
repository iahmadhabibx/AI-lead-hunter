import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { LoginRequest, RegisterRequest } from '@aijh/contracts';
import type { RequestWithId } from '../common/request-id.middleware';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { SessionGuard } from './session.guard';
import type { UserPublic } from '@aijh/contracts';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post('register')
  @HttpCode(200)
  async register(
    @Body() body: RegisterRequest,
    @Req() req: RequestWithId,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.register(body, {
      requestId: req.requestId,
    });
    res.cookie(
      this.auth.cookieName(),
      result.sessionToken,
      this.auth.cookieOptions(),
    );
    return { user: result.user };
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: LoginRequest,
    @Req() req: RequestWithId,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(body, { requestId: req.requestId });
    res.cookie(
      this.auth.cookieName(),
      result.sessionToken,
      this.auth.cookieOptions(),
    );
    return { user: result.user };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[this.auth.cookieName()] as string | undefined;
    await this.auth.logout(token);
    res.clearCookie(this.auth.cookieName(), { path: '/' });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@CurrentUser() user: UserPublic) {
    return { user };
  }
}

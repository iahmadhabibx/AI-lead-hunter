import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { UserPublic } from '@aijh/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { AccountService } from './account.service';

@ApiTags('account')
@Controller('account')
@UseGuards(SessionGuard)
export class AccountController {
  constructor(@Inject(AccountService) private readonly account: AccountService) {}

  @Post('export')
  @HttpCode(200)
  export(@CurrentUser() user: UserPublic) {
    return this.account.requestExport(user.id);
  }

  @Get('export/download')
  async download(
    @CurrentUser() user: UserPublic,
    @Res({ passthrough: false }) res: Response,
  ) {
    const file = await this.account.downloadLatestExport(user.id);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    res.send(file.body);
  }

  @Post('delete')
  @HttpCode(200)
  delete(@CurrentUser() user: UserPublic, @Body() body: unknown) {
    return this.account.requestDelete(user.id, user.email, body);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { UserPublic } from '@aijh/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { MatchService } from './match.service';

@ApiTags('matches')
@Controller()
@UseGuards(SessionGuard)
export class MatchController {
  constructor(@Inject(MatchService) private readonly matches: MatchService) {}

  @Post('matches/run')
  @HttpCode(200)
  run(@CurrentUser() user: UserPublic, @Query('limit') limit?: string) {
    const n = limit ? Number(limit) : undefined;
    return this.matches.triggerMatch(user.id, {
      limit: n && Number.isFinite(n) ? n : undefined,
    });
  }

  @Get('matches')
  list(@CurrentUser() user: UserPublic, @Query('limit') limit?: string) {
    const n = limit ? Number(limit) : 50;
    return this.matches.listMatches(user.id, Number.isFinite(n) ? n : 50);
  }

  @Get('matches/:id')
  get(@CurrentUser() user: UserPublic, @Param('id') id: string) {
    return this.matches.getMatch(user.id, id);
  }

  @Post('saved-jobs')
  @HttpCode(200)
  save(
    @CurrentUser() user: UserPublic,
    @Body()
    body: { canonicalJobId: string; matchResultId?: string; note?: string },
  ) {
    return this.matches.saveJob(user.id, body);
  }

  @Get('saved-jobs')
  listSaved(@CurrentUser() user: UserPublic) {
    return this.matches.listSaved(user.id);
  }

  @Delete('saved-jobs/:canonicalJobId')
  @HttpCode(200)
  unsave(
    @CurrentUser() user: UserPublic,
    @Param('canonicalJobId') canonicalJobId: string,
  ) {
    return this.matches.unsaveJob(user.id, canonicalJobId);
  }

  @Post('matches/reject')
  @HttpCode(200)
  reject(@CurrentUser() user: UserPublic, @Body() body: unknown) {
    return this.matches.rejectJob(user.id, body);
  }

  @Post('feedback')
  @HttpCode(200)
  feedback(@CurrentUser() user: UserPublic, @Body() body: unknown) {
    return this.matches.createFeedback(user.id, body);
  }

  @Get('feedback')
  listFeedback(
    @CurrentUser() user: UserPublic,
    @Query('limit') limit?: string,
  ) {
    const n = limit ? Number(limit) : 50;
    return this.matches.listFeedback(user.id, Number.isFinite(n) ? n : 50);
  }
}

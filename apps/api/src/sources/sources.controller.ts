import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { UserPublic } from '@aijh/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { SourcesService } from './sources.service';

@ApiTags('sources')
@Controller('sources')
@UseGuards(SessionGuard)
export class SourcesController {
  constructor(
    @Inject(SourcesService) private readonly sources: SourcesService,
  ) {}

  @Get()
  status() {
    return this.sources.listStatus();
  }

  @Post('discover')
  @HttpCode(200)
  discover(
    @CurrentUser() user: UserPublic,
    @Query('sourceKey') sourceKey?: string,
  ) {
    return this.sources.triggerDiscover(user.id, sourceKey);
  }

  @Get('jobs')
  jobs(@Query('limit') limit?: string) {
    const n = limit ? Number(limit) : 20;
    return this.sources.listJobs(Number.isFinite(n) ? n : 20);
  }
}

import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { UserPublic } from '@aijh/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { ProfileService } from './profile.service';

@ApiTags('profile')
@Controller('profile')
@UseGuards(SessionGuard)
export class ProfileController {
  constructor(
    @Inject(ProfileService) private readonly profiles: ProfileService,
  ) {}

  @Get()
  getCurrent(@CurrentUser() user: UserPublic) {
    return this.profiles.getCurrent(user.id);
  }

  @Get('versions')
  async listVersions(@CurrentUser() user: UserPublic) {
    return { versions: await this.profiles.listVersions(user.id) };
  }

  @Patch('draft')
  updateDraft(@CurrentUser() user: UserPublic, @Body() body: unknown) {
    return this.profiles.updatePendingDraft(user.id, body);
  }

  @Post('approve')
  @HttpCode(200)
  approve(@CurrentUser() user: UserPublic) {
    return this.profiles.approvePending(user.id);
  }
}

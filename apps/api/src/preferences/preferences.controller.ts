import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { UserPublic } from '@aijh/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { PreferencesService } from './preferences.service';

@ApiTags('preferences')
@Controller('preferences')
@UseGuards(SessionGuard)
export class PreferencesController {
  constructor(
    @Inject(PreferencesService) private readonly preferences: PreferencesService,
  ) {}

  @Get('learned')
  async getLearned(@CurrentUser() user: UserPublic) {
    const active = await this.preferences.getActive(user.id);
    return {
      learned: active,
      note: 'Explicit profile preferences override learned signals. Reset clears learned state only.',
    };
  }

  @Post('learned/recompute')
  @HttpCode(200)
  recompute(@CurrentUser() user: UserPublic) {
    return this.preferences.recompute(user.id);
  }

  @Post('learned/reset')
  @HttpCode(200)
  reset(@CurrentUser() user: UserPublic) {
    return this.preferences.reset(user.id);
  }
}

import { Module } from '@nestjs/common';
import { AuthRateLimitGuard } from '../common/rate-limit.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionGuard } from './session.guard';

@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionGuard, AuthRateLimitGuard],
  exports: [AuthService, SessionGuard],
})
export class AuthModule {}

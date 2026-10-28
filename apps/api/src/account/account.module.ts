import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CvModule } from '../cv/cv.module';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';

@Module({
  imports: [AuthModule, CvModule],
  controllers: [AccountController],
  providers: [AccountService],
  exports: [AccountService],
})
export class AccountModule {}

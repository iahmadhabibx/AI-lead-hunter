import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorageService } from '../storage/storage.service';
import { CvController } from './cv.controller';
import { CvService } from './cv.service';

@Module({
  imports: [AuthModule],
  controllers: [CvController],
  providers: [CvService, StorageService],
  exports: [CvService, StorageService],
})
export class CvModule {}

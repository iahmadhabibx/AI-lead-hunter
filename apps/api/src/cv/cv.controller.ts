import {
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { UserPublic } from '@aijh/contracts';
import type { Request } from 'express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { AppHttpException } from '../common/app-http.exception';
import { CvService } from './cv.service';

@ApiTags('cv')
@Controller('cv')
@UseGuards(SessionGuard)
export class CvController {
  constructor(@Inject(CvService) private readonly cv: CvService) {}

  @Post('uploads')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  async upload(
    @CurrentUser() user: UserPublic,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
  ) {
    if (!file?.buffer?.length) {
      throw new AppHttpException('VALIDATION_ERROR', 'file is required');
    }
    const idempotencyKey = req.header('idempotency-key') ?? undefined;
    return this.cv.upload({
      userId: user.id,
      originalFilename: file.originalname || 'cv',
      buffer: file.buffer,
      idempotencyKey,
    });
  }

  @Get('documents/:id')
  async getDocument(
    @CurrentUser() user: UserPublic,
    @Param('id') id: string,
  ) {
    return this.cv.getDocument(user.id, id);
  }
}

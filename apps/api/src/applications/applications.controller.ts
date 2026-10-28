import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { UserPublic } from '@aijh/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { ApplicationsService } from './applications.service';

@ApiTags('applications')
@Controller()
@UseGuards(SessionGuard)
export class ApplicationsController {
  constructor(
    @Inject(ApplicationsService)
    private readonly applications: ApplicationsService,
  ) {}

  @Post('applications')
  @HttpCode(200)
  create(@CurrentUser() user: UserPublic, @Body() body: unknown) {
    return this.applications.create(user.id, body);
  }

  @Get('applications')
  list(@CurrentUser() user: UserPublic) {
    return this.applications.list(user.id);
  }

  @Get('applications/:id')
  get(@CurrentUser() user: UserPublic, @Param('id') id: string) {
    return this.applications.get(user.id, id);
  }

  @Patch('applications/:id/status')
  @HttpCode(200)
  status(
    @CurrentUser() user: UserPublic,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.applications.updateStatus(user.id, id, body);
  }

  @Post('applications/generate')
  @HttpCode(200)
  generate(@CurrentUser() user: UserPublic, @Body() body: unknown) {
    return this.applications.enqueueGenerate(user.id, body);
  }

  @Get('documents/:id')
  getDocument(@CurrentUser() user: UserPublic, @Param('id') id: string) {
    return this.applications.getDocument(user.id, id);
  }

  @Patch('documents/:id')
  @HttpCode(200)
  updateDocument(
    @CurrentUser() user: UserPublic,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.applications.updateDocument(user.id, id, body);
  }

  @Post('documents/:id/approve')
  @HttpCode(200)
  approveDocument(@CurrentUser() user: UserPublic, @Param('id') id: string) {
    return this.applications.approveDocument(user.id, id);
  }

  @Get('documents/:id/export')
  async exportDocument(
    @CurrentUser() user: UserPublic,
    @Param('id') id: string,
    @Res({ passthrough: false }) res: Response,
  ) {
    const exported = await this.applications.exportDocument(user.id, id);
    res.setHeader('Content-Type', exported.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${exported.filename}"`,
    );
    res.send(exported.body);
  }
}

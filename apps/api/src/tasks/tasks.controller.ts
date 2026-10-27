import { Controller, Get, Inject, Param, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { UserPublic } from '@aijh/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { TasksService } from './tasks.service';

@ApiTags('tasks')
@Controller('tasks')
@UseGuards(SessionGuard)
export class TasksController {
  constructor(@Inject(TasksService) private readonly tasks: TasksService) {}

  @Get(':id')
  get(@CurrentUser() user: UserPublic, @Param('id') id: string) {
    return this.tasks.getTask(user.id, id);
  }
}

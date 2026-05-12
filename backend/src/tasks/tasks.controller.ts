import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto, UpdateTaskStatusDto } from './dto/create-task.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private tasksService: TasksService) {}

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateTaskDto) {
    return this.tasksService.create(userId, dto);
  }

  @Get('today')
  getTodaysTasks(@CurrentUser('id') userId: string) {
    return this.tasksService.getTodaysTasks(userId);
  }

  @Get('my')
  getUserTasks(
    @CurrentUser('id') userId: string,
    @Query('status') status?: string,
  ) {
    return this.tasksService.getUserTasks(userId, status);
  }

  @Get('subtopic/:subtopicId')
  findBySubtopic(
    @Param('subtopicId') subtopicId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.tasksService.findBySubtopic(subtopicId, userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id);
  }

  @Put(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateTaskStatusDto) {
    return this.tasksService.updateStatus(id, dto);
  }

  @Post(':id/start')
  startSession(@Param('id') taskId: string, @CurrentUser('id') userId: string) {
    return this.tasksService.startSession(taskId, userId);
  }

  @Post('session/:sessionId/finish')
  finishSession(@Param('sessionId') sessionId: string) {
    return this.tasksService.finishSession(sessionId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tasksService.remove(id);
  }
}

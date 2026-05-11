import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/feedback')
@UseGuards(JwtAuthGuard)
export class FeedbackController {
  constructor(private feedbackService: FeedbackService) {}

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateFeedbackDto) {
    return this.feedbackService.create(userId, dto);
  }

  @Get('task/:taskId')
  findByTask(@Param('taskId') taskId: string) {
    return this.feedbackService.findByTask(taskId);
  }

  @Get('my')
  findByUser(@CurrentUser('id') userId: string) {
    return this.feedbackService.findByUser(userId);
  }
}

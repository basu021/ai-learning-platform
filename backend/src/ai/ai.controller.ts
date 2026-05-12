import { Controller, Post, Body, Param, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private aiService: AiService) {}

  @Post('generate/:subtopicId')
  generateTasks(
    @CurrentUser('id') userId: string,
    @Param('subtopicId') subtopicId: string,
    @Body('count') count?: number,
  ) {
    return this.aiService.generateTasksForSubtopic(
      userId,
      subtopicId,
      count || 5,
    );
  }

  @Post('analyze/:taskId')
  analyzeFeedback(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.aiService.analyzeFeedbackAndAdapt(userId, taskId);
  }
}

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
import { SubtopicsService } from './subtopics.service';
import {
  CreateSubtopicDto,
  UpdateSubtopicDto,
} from './dto/create-subtopic.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/subtopics')
@UseGuards(JwtAuthGuard)
export class SubtopicsController {
  constructor(private subtopicsService: SubtopicsService) {}

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateSubtopicDto) {
    return this.subtopicsService.create(userId, dto);
  }

  @Get()
  findByTopic(
    @CurrentUser('id') userId: string,
    @Query('topicId') topicId: string,
  ) {
    return this.subtopicsService.findByTopic(topicId, userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.subtopicsService.findOne(id, userId);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateSubtopicDto,
  ) {
    return this.subtopicsService.update(id, userId, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.subtopicsService.remove(id, userId);
  }
}

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
import { TopicsService } from './topics.service';
import { CreateTopicDto, UpdateTopicDto } from './dto/create-topic.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/topics')
@UseGuards(JwtAuthGuard)
export class TopicsController {
  constructor(private topicsService: TopicsService) {}

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateTopicDto) {
    return this.topicsService.create(userId, dto);
  }

  @Get()
  findBySubject(
    @CurrentUser('id') userId: string,
    @Query('subjectId') subjectId: string,
  ) {
    return this.topicsService.findBySubject(subjectId, userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.topicsService.findOne(id, userId);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateTopicDto,
  ) {
    return this.topicsService.update(id, userId, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.topicsService.remove(id, userId);
  }
}

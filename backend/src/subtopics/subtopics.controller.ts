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

@Controller('api/subtopics')
@UseGuards(JwtAuthGuard)
export class SubtopicsController {
  constructor(private subtopicsService: SubtopicsService) {}

  @Post()
  create(@Body() dto: CreateSubtopicDto) {
    return this.subtopicsService.create(dto);
  }

  @Get()
  findByTopic(@Query('topicId') topicId: string) {
    return this.subtopicsService.findByTopic(topicId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.subtopicsService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSubtopicDto) {
    return this.subtopicsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.subtopicsService.remove(id);
  }
}

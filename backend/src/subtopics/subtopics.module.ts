import { Module } from '@nestjs/common';
import { SubtopicsService } from './subtopics.service';
import { SubtopicsController } from './subtopics.controller';

@Module({
  providers: [SubtopicsService],
  controllers: [SubtopicsController],
  exports: [SubtopicsService],
})
export class SubtopicsModule {}

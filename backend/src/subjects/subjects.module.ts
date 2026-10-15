import { Module } from '@nestjs/common';
import { AccessService } from './access.service';
import { ContentService } from './content.service';
import { SubjectsService } from './subjects.service';
import {
  CategoriesController,
  ReviewsController,
  SubjectsController,
} from './subjects.controller';

@Module({
  providers: [AccessService, ContentService, SubjectsService],
  controllers: [SubjectsController, ReviewsController, CategoriesController],
  exports: [AccessService, ContentService],
})
export class SubjectsModule {}

import { Module } from '@nestjs/common';
import { AccessService } from './access.service';
import { ContentService } from './content.service';
import { SubjectsService } from './subjects.service';
import { ProgressService } from './progress.service';
import { ProgressController } from './progress.controller';
import {
  CategoriesController,
  ReviewsController,
  SubjectsController,
} from './subjects.controller';

@Module({
  providers: [AccessService, ContentService, SubjectsService, ProgressService],
  controllers: [
    SubjectsController,
    ReviewsController,
    CategoriesController,
    ProgressController,
  ],
  exports: [AccessService, ContentService, ProgressService],
})
export class SubjectsModule {}

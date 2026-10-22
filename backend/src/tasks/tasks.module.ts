import { Module } from '@nestjs/common';
import { SubjectsModule } from '../subjects/subjects.module';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { TemplatesService } from './templates.service';
import { TemplatesController } from './templates.controller';

@Module({
  imports: [SubjectsModule],
  providers: [TasksService, TemplatesService],
  controllers: [TasksController, TemplatesController],
  exports: [TasksService],
})
export class TasksModule {}

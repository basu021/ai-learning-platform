import { Module } from '@nestjs/common';
import { TasksModule } from '../tasks/tasks.module';
import { SubjectsModule } from '../subjects/subjects.module';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [TasksModule, SubjectsModule],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}

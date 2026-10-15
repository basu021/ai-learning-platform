import { Module } from '@nestjs/common';
import { TasksModule } from '../tasks/tasks.module';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [TasksModule],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}

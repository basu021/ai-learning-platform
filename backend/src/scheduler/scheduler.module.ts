import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { SchedulerController } from './scheduler.controller';
import { AiModule } from '../ai/ai.module';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [AiModule, GamificationModule],
  providers: [SchedulerService],
  controllers: [SchedulerController],
  exports: [SchedulerService],
})
export class SchedulerModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SubjectsModule } from './subjects/subjects.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { TasksModule } from './tasks/tasks.module';
import { FeedbackModule } from './feedback/feedback.module';
import { GamificationModule } from './gamification/gamification.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AdminModule } from './admin/admin.module';

import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    NotificationsModule,
    SubjectsModule,
    AttachmentsModule,
    TasksModule,
    FeedbackModule,
    GamificationModule,
    DashboardModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

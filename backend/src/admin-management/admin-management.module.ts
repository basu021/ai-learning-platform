import { Module } from '@nestjs/common';
import { AdminManagementService } from './admin-management.service';
import { AdminManagementController } from './admin-management.controller';

@Module({
  providers: [AdminManagementService],
  controllers: [AdminManagementController],
})
export class AdminManagementModule {}

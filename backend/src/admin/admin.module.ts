import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminService } from './admin.service';
import { AdminController, UsersController } from './admin.controller';

@Module({
  imports: [AuthModule],
  providers: [AdminService],
  controllers: [AdminController, UsersController],
})
export class AdminModule {}

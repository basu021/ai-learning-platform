import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminManagementService } from './admin-management.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  AssignContentDto,
  AdminCreateUserDto,
  AdminUpdateSubjectDto,
  AdminUpdateTopicDto,
  AdminUpdateSubtopicDto,
  AdminUpdateTaskDto,
} from './dto/assign-content.dto';

@Controller('api/admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminManagementController {
  constructor(private adminService: AdminManagementService) {}

  @Get('users')
  listUsers(@Query('role') role?: string) {
    return this.adminService.listUsers(role);
  }

  @Post('users')
  createUser(@Body() dto: AdminCreateUserDto) {
    return this.adminService.createUser(dto);
  }

  @Get('users/:id')
  getUserOverview(@Param('id') id: string) {
    return this.adminService.getUserOverview(id);
  }

  @Get('tasks')
  listTasks(@Query('status') status?: string, @Query('userId') userId?: string) {
    return this.adminService.listTasks({ status, userId });
  }

  @Get('assignments')
  listAssignments() {
    return this.adminService.listAssignments();
  }

  @Post('assign')
  assignContent(@CurrentUser('id') adminId: string, @Body() dto: AssignContentDto) {
    return this.adminService.assignContent(adminId, dto);
  }

  @Put('subjects/:id')
  updateSubject(@Param('id') id: string, @Body() dto: AdminUpdateSubjectDto) {
    return this.adminService.updateSubject(id, dto);
  }

  @Delete('subjects/:id')
  deleteSubject(@Param('id') id: string) {
    return this.adminService.deleteSubject(id);
  }

  @Put('topics/:id')
  updateTopic(@Param('id') id: string, @Body() dto: AdminUpdateTopicDto) {
    return this.adminService.updateTopic(id, dto);
  }

  @Delete('topics/:id')
  deleteTopic(@Param('id') id: string) {
    return this.adminService.deleteTopic(id);
  }

  @Put('subtopics/:id')
  updateSubtopic(@Param('id') id: string, @Body() dto: AdminUpdateSubtopicDto) {
    return this.adminService.updateSubtopic(id, dto);
  }

  @Delete('subtopics/:id')
  deleteSubtopic(@Param('id') id: string) {
    return this.adminService.deleteSubtopic(id);
  }

  @Put('tasks/:id')
  updateTask(@Param('id') id: string, @Body() dto: AdminUpdateTaskDto) {
    return this.adminService.updateTask(id, dto);
  }

  @Delete('tasks/:id')
  deleteTask(@Param('id') id: string) {
    return this.adminService.deleteTask(id);
  }
}

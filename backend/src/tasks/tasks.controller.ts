import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator';
import { TasksService } from './tasks.service';
import {
  CreateTaskDto,
  ListTasksQuery,
  UpdateTaskDto,
} from './dto/create-task.dto';

@Controller('api/tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private tasks: TasksService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTaskDto) {
    return this.tasks.create(user, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: ListTasksQuery) {
    return this.tasks.list(user, q);
  }

  @Get('agenda')
  agenda(@CurrentUser('id') userId: string) {
    return this.tasks.agenda(userId);
  }

  @Get('history')
  history(@CurrentUser() user: AuthUser, @Query('userId') userId?: string) {
    return this.tasks.history(user, userId || user.id);
  }

  @Get('occurrences/:id')
  occurrence(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tasks.getOccurrence(user, id);
  }

  @Post('occurrences/:id/start')
  start(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tasks.start(user, id);
  }

  @Post('occurrences/:id/skip')
  skip(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tasks.skip(user, id);
  }

  @Post('sessions/:id/finish')
  finish(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tasks.finishSession(user, id);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tasks.get(user, id);
  }

  @Put(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasks.update(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tasks.remove(user, id);
  }
}

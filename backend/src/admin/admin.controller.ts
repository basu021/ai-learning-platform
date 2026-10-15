import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { AdminService } from './admin.service';
import { AdminCreateUserDto, AdminUpdateUserDto } from './admin.dto';

@Controller('api/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private admin: AdminService) {}

  @Get('stats')
  stats() {
    return this.admin.stats();
  }

  @Get('users')
  users(@Query('q') q?: string) {
    return this.admin.listUsers(q);
  }

  @Post('users')
  createUser(@Body() dto: AdminCreateUserDto) {
    return this.admin.createUser(dto);
  }

  @Get('users/:id')
  user(@Param('id') id: string) {
    return this.admin.userDetail(id);
  }

  @Patch('users/:id')
  updateUser(
    @CurrentUser() admin: AuthUser,
    @Param('id') id: string,
    @Body() dto: AdminUpdateUserDto,
  ) {
    return this.admin.updateUser(admin, id, dto);
  }

  @Get('access-requests')
  accessRequests() {
    return this.admin.pendingAccessRequests();
  }

  @Get('changes')
  changes() {
    return this.admin.pendingChanges();
  }
}

/** Username lookup for sharing/assigning; available to every signed-in user. */
@Controller('api/users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private prisma: PrismaService) {}

  @Get('search')
  search(@CurrentUser('id') me: string, @Query('q') q = '') {
    const term = q.trim().toLowerCase().replace(/^@/, '');
    if (term.length < 2) return [];
    return this.prisma.user.findMany({
      where: {
        deletedAt: null,
        id: { not: me },
        OR: [{ username: { startsWith: term } }, { name: { contains: term } }],
      },
      select: { id: true, username: true, name: true },
      take: 8,
    });
  }
}

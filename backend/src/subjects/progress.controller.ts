import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ProgressService } from './progress.service';

class ItemDto {
  /** Omit for the subject overview. */
  @IsOptional()
  @IsString()
  nodeId?: string | null;
}

class HeartbeatDto extends ItemDto {
  @IsInt()
  @Min(0)
  @Max(600)
  seconds: number;

  /** First beat after the item was opened. */
  @IsOptional()
  @IsBoolean()
  opened?: boolean;
}

@Controller('api/progress')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProgressController {
  constructor(
    private progress: ProgressService,
    private prisma: PrismaService,
  ) {}

  @Get('recent')
  recent(@CurrentUser('id') userId: string) {
    return this.progress.recent(userId);
  }

  @Get('subjects/:id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.progress.get(user, id);
  }

  @Post('subjects/:id/heartbeat')
  heartbeat(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: HeartbeatDto,
  ) {
    return this.progress.heartbeat(
      user,
      id,
      dto.nodeId || null,
      dto.seconds,
      !!dto.opened,
    );
  }

  @Post('subjects/:id/complete')
  complete(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ItemDto,
  ) {
    return this.progress.setComplete(user, id, dto.nodeId || null, true);
  }

  @Post('subjects/:id/uncomplete')
  uncomplete(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ItemDto,
  ) {
    return this.progress.setComplete(user, id, dto.nodeId || null, false);
  }

  @Post('subjects/:id/reset')
  reset(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ItemDto,
  ) {
    return this.progress.reset(user, id, dto.nodeId || null);
  }

  /** Admin: a user's reading progress across the subjects they own, are shared or have opened. */
  @Get('users/:userId')
  @Roles('ADMIN')
  async forUser(@Param('userId') userId: string) {
    const [owned, member, read] = await Promise.all([
      this.prisma.subject.findMany({
        where: { ownerId: userId, deletedAt: null },
        select: { id: true },
      }),
      this.prisma.subjectMember.findMany({
        where: { userId },
        select: { subjectId: true },
      }),
      this.prisma.readProgress.findMany({
        where: { userId },
        select: { subjectId: true },
        distinct: ['subjectId'],
      }),
    ]);
    return this.progress.summaries(userId, [
      ...owned.map((s) => s.id),
      ...member.map((m) => m.subjectId),
      ...read.map((r) => r.subjectId),
    ]);
  }
}

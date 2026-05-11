import { Controller, Get, UseGuards } from '@nestjs/common';
import { GamificationService } from './gamification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/gamification')
@UseGuards(JwtAuthGuard)
export class GamificationController {
  constructor(private gamificationService: GamificationService) {}

  @Get('stats')
  getStats(@CurrentUser('id') userId: string) {
    return this.gamificationService.getStats(userId);
  }

  @Get('heatmap')
  getHeatmap(@CurrentUser('id') userId: string) {
    return this.gamificationService.getActivityHeatmap(userId);
  }
}

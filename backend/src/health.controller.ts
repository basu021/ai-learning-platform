import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

/** Public liveness check for the host: GET /api/health. */
@Controller('api/health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async check() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  }
}

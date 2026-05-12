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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ConfigAdminService } from './config-admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  UpsertConfigDto,
  BulkUpsertConfigDto,
  TestSmtpDto,
  PromoteAdminDto,
} from './dto/upsert-config.dto';

@Controller('api/admin/config')
export class ConfigAdminController {
  constructor(private configAdminService: ConfigAdminService) {}

  @Post('promote')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async promoteToAdmin(
    @CurrentUser('id') userId: string,
    @Body() dto: PromoteAdminDto,
  ) {
    return this.configAdminService.promoteToAdmin(userId, dto.setupKey);
  }

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getAll() {
    return this.configAdminService.getAll();
  }

  @Get('category/:category')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getByCategory(@Param('category') category: string) {
    return this.configAdminService.getByCategory(category);
  }

  @Put()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async upsert(@Body() dto: UpsertConfigDto) {
    return this.configAdminService.upsert(
      dto.key,
      dto.value,
      dto.category,
      dto.label,
      dto.encrypted,
    );
  }

  @Put('bulk')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async bulkUpsert(@Body() dto: BulkUpsertConfigDto) {
    return this.configAdminService.bulkUpsert(dto.configs);
  }

  @Delete(':key')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async delete(@Param('key') key: string) {
    return this.configAdminService.delete(key);
  }

  @Post('smtp/test')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  async testSmtp(@Body() dto: TestSmtpDto) {
    return this.configAdminService.testSmtp(dto.to);
  }

  @Get('email-logs')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getEmailLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.configAdminService.getEmailLogs(
      page ? Number(page) : 1,
      limit ? Number(limit) : 50,
    );
  }
}

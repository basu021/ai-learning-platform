import { Module } from '@nestjs/common';
import { ConfigAdminService } from './config-admin.service';
import { ConfigAdminController } from './config-admin.controller';

@Module({
  providers: [ConfigAdminService],
  controllers: [ConfigAdminController],
  exports: [ConfigAdminService],
})
export class ConfigAdminModule {}

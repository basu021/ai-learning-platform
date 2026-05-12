import { IsString, IsOptional, IsBoolean, IsIn } from 'class-validator';

export class UpsertConfigDto {
  @IsString()
  key: string;

  @IsString()
  value: string;

  @IsOptional()
  @IsBoolean()
  encrypted?: boolean;

  @IsOptional()
  @IsIn(['general', 'smtp', 'ai', 'auth', 'app'])
  category?: string;

  @IsOptional()
  @IsString()
  label?: string;
}

export class BulkUpsertConfigDto {
  configs: UpsertConfigDto[];
}

export class TestSmtpDto {
  @IsString()
  to: string;
}

export class PromoteAdminDto {
  @IsString()
  setupKey: string;
}

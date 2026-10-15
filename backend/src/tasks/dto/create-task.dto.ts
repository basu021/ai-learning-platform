import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Frequency } from '@prisma/client';

export class ScheduleDto {
  @IsEnum(Frequency)
  frequency: Frequency;

  /** Only used for WEEKLY; the service requires at least one there. */
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  weekdays?: number[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  monthDay?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  intervalDays?: number;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string | null;
}

export class CreateTaskDto {
  @IsString()
  subjectId: string;

  @IsOptional()
  @IsString()
  nodeId?: string | null;

  @IsString()
  @MinLength(2)
  @MaxLength(191)
  title: string;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @IsIn(['beginner', 'intermediate', 'advanced', 'expert'])
  difficulty?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  estimatedMins?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  xpReward?: number;

  /** Admin only: create the task for these users (by username). Defaults to yourself. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  assignees?: string[];

  @ValidateNested()
  @Type(() => ScheduleDto)
  schedule: ScheduleDto;
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(191)
  title?: string;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @IsIn(['beginner', 'intermediate', 'advanced', 'expert'])
  difficulty?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  estimatedMins?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  xpReward?: number;

  @IsOptional()
  @IsString()
  nodeId?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => ScheduleDto)
  schedule?: ScheduleDto;

  @IsOptional()
  active?: boolean;
}

export class ListTasksQuery {
  @IsOptional()
  @IsIn(['mine', 'assigned', 'all'])
  scope?: 'mine' | 'assigned' | 'all';

  @IsOptional()
  @IsString()
  assigneeId?: string;

  @IsOptional()
  @IsString()
  subjectId?: string;
}

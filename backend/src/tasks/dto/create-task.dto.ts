import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
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

/** Schedule for an auto-assigned task, counted from the day the learner completes the trigger. */
export class RelativeScheduleDto {
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

  /** 0 = start on the completion day. */
  @IsInt()
  @Min(0)
  @Max(365)
  startAfterDays: number;

  /** Repeating tasks only: stop after this many days. Empty = no end. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  durationDays?: number | null;
}

export class CreateTemplateDto {
  @IsString()
  subjectId: string;

  @IsOptional()
  @IsString()
  nodeId?: string | null;

  /** Assign when the learner completes this node (and everything under it). Empty = whole subject. */
  @IsOptional()
  @IsString()
  triggerNodeId?: string | null;

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

  @ValidateNested()
  @Type(() => RelativeScheduleDto)
  schedule: RelativeScheduleDto;
}

export class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  nodeId?: string | null;

  @IsOptional()
  @IsString()
  triggerNodeId?: string | null;

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
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => RelativeScheduleDto)
  schedule?: RelativeScheduleDto;
}

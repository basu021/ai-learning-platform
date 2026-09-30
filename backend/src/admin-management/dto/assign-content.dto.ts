import { Type } from 'class-transformer';
import {
  IsArray,
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsIn,
  IsEmail,
  Min,
  MinLength,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';

export class AdminCreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsIn(['user', 'admin'])
  role?: string;
}

export class AssignTaskInputDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsIn(['beginner', 'intermediate', 'advanced', 'expert'])
  difficulty?: string;

  @IsOptional()
  @IsIn(['practice', 'troubleshooting', 'scenario', 'revision'])
  taskType?: string;

  @IsOptional()
  @IsInt()
  estimatedMins?: number;

  @IsOptional()
  @IsInt()
  xpReward?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  repeatIntervalHours?: number;
}

export class AssignContentDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  userIds: string[];

  @IsString()
  @MinLength(2)
  subjectName: string;

  @IsOptional()
  @IsString()
  subjectDescription?: string;

  @IsOptional()
  @IsString()
  subjectIcon?: string;

  @IsOptional()
  @IsString()
  subjectColor?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  topicName?: string;

  @IsOptional()
  @IsString()
  topicDescription?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  subtopicName?: string;

  @IsOptional()
  @IsString()
  subtopicDescription?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssignTaskInputDto)
  tasks?: AssignTaskInputDto[];
}

export class AdminUpdateSubjectDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  color?: string;
}

export class AdminUpdateTopicDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  icon?: string;
}

export class AdminUpdateSubtopicDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  icon?: string;
}

export class AdminUpdateTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['beginner', 'intermediate', 'advanced', 'expert'])
  difficulty?: string;

  @IsOptional()
  @IsIn(['practice', 'troubleshooting', 'scenario', 'revision'])
  taskType?: string;

  @IsOptional()
  @IsIn([
    'pending',
    'started',
    'in_progress',
    'completed',
    'skipped',
    'revision_required',
  ])
  status?: string;

  @IsOptional()
  @IsInt()
  estimatedMins?: number;

  @IsOptional()
  @IsInt()
  xpReward?: number;

  @IsOptional()
  @IsBoolean()
  isRevision?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  repeatIntervalHours?: number; // 0 clears the repeat interval (makes it one-time again)
}

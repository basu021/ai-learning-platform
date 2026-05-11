import {
  IsString,
  IsOptional,
  IsInt,
  IsUUID,
  IsBoolean,
  IsIn,
} from 'class-validator';

export class CreateTaskDto {
  @IsUUID()
  subtopicId: string;

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
  @IsBoolean()
  isRevision?: boolean;

  @IsOptional()
  @IsString()
  hints?: string;

  @IsOptional()
  @IsString()
  commands?: string;

  @IsOptional()
  @IsString()
  tags?: string;
}

export class UpdateTaskStatusDto {
  @IsIn([
    'pending',
    'started',
    'in_progress',
    'completed',
    'skipped',
    'revision_required',
  ])
  status: string;
}

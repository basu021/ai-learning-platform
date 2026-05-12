import { IsString, IsOptional, IsInt, IsUUID, Min, Max } from 'class-validator';

export class CreateFeedbackDto {
  @IsUUID()
  taskId: string;

  @IsOptional()
  @IsString()
  whatWasDone?: string;

  @IsOptional()
  @IsString()
  problemsFaced?: string;

  @IsOptional()
  @IsString()
  commandsUsed?: string;

  @IsInt()
  @Min(1)
  @Max(5)
  confidenceLevel: number;

  @IsOptional()
  @IsString()
  needsImprovement?: string;

  @IsOptional()
  @IsString()
  notesForTomorrow?: string;
}

import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  MemberRole,
  NodeType,
  PublishStatus,
  Visibility,
} from '@prisma/client';

export class CreateSubjectDto {
  @IsString()
  @MinLength(2)
  @MaxLength(191)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  summary?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsEnum(Visibility)
  visibility?: Visibility;

  @IsOptional()
  @IsEnum(PublishStatus)
  status?: PublishStatus;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  tags?: string;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  color?: string;
}

export class UpdateSettingsDto {
  @IsOptional()
  @IsEnum(Visibility)
  visibility?: Visibility;

  @IsOptional()
  @IsEnum(PublishStatus)
  status?: PublishStatus;

  @IsOptional()
  @IsString()
  categoryId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  tags?: string;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  color?: string;
}

export class ContentEditDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  summary?: string | null;

  @IsOptional()
  @IsString()
  content?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  changeNote?: string;
}

export class CreateNodeDto extends ContentEditDto {
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  declare title: string;

  @IsEnum(NodeType)
  type: NodeType;

  @IsOptional()
  @IsString()
  parentId?: string | null;
}

export class ReorderDto {
  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsArray()
  @IsString({ each: true })
  orderedIds: string[];
}

export class PreviewDto {
  @IsBoolean()
  isPreview: boolean;
}

export class AddMembersDto {
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  usernames: string[];

  @IsOptional()
  @IsEnum(MemberRole)
  role?: MemberRole;
}

export class UpdateMemberDto {
  @IsEnum(MemberRole)
  role: MemberRole;
}

export class AccessRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}

export class ReviewDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class CategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  description?: string;
}

export class ListSubjectsQuery {
  @IsOptional()
  @IsIn(['library', 'mine', 'shared', 'catalog', 'all'])
  scope?: 'library' | 'mine' | 'shared' | 'catalog' | 'all';

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsEnum(Visibility)
  visibility?: Visibility;

  @IsOptional()
  @IsEnum(PublishStatus)
  status?: PublishStatus;

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @IsString()
  ownerId?: string;
}

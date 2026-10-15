import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  Matches,
} from 'class-validator';

export const USERNAME_PATTERN = /^[a-z0-9_.-]{3,30}$/;

export class RegisterDto {
  @IsEmail()
  email: string;

  @Matches(USERNAME_PATTERN, {
    message:
      'username must be 3-30 characters: lowercase letters, numbers, dot, dash or underscore',
  })
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  avatar?: string;
}

import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  // Email address or username
  @IsString()
  @MinLength(3)
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}

import {
  EMAIL_MAX_LENGTH,
  LoginRequest,
  PASSWORD_MAX_LENGTH,
} from '@teamflow/shared';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto implements LoginRequest {
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email!: string;

  // No MinLength here on purpose: login must not reveal the password policy, and
  // a policy change must not lock out users whose old password is shorter.
  @IsString()
  @IsNotEmpty()
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;
}

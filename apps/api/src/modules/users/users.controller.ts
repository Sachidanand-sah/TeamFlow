import { Controller, Get } from '@nestjs/common';
import { UserDto } from '@teamflow/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** Protected by the global JwtAuthGuard: no @Public(), so a valid access token is required. */
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): Promise<UserDto> {
    return this.users.getProfile(user.id);
  }
}

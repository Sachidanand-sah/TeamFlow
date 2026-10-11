import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  // Only the service is exported: other modules must go through business rules,
  // never straight to the repository.
  exports: [UsersService],
})
export class UsersModule {}

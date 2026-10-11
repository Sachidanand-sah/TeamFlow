import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** Global so every domain module's repository can inject PrismaService. */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}

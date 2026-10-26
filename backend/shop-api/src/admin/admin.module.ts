import { APP_GUARD } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AdminAccessGuard } from './access.js';
import { TypeOrmAdminRepository } from './repositories/typeorm-admin.repository.js';
import { AdminRepository } from './repositories/admin.repository.js';
import { AdminRestController } from './controllers/admin-rest.controller.js';
import {
  SignInCommandHandler,
  SignOutCommandHandler,
} from './commands/handlers/session-command.handler.js';
@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 5 }])],
  controllers: [AdminRestController],
  providers: [
    { provide: AdminRepository, useClass: TypeOrmAdminRepository },
    SignInCommandHandler,
    SignOutCommandHandler,
    { provide: APP_GUARD, useClass: AdminAccessGuard },
  ],
})
export class AdminModule {}

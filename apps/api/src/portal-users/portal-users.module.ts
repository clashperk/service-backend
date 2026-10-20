import { Module } from '@nestjs/common';
import { PortalUsersController } from './portal-users.controller';
import { PortalUsersService } from './portal-users.service';

@Module({
  controllers: [PortalUsersController],
  providers: [PortalUsersService],
})
export class PortalUsersModule {}

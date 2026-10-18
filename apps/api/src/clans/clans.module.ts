import { Global, Module } from '@nestjs/common';
import { ClanActivityService } from './clan-activity.service';
import { ClanMembersService } from './clan-members.service';
import { ClansController } from './clans.controller';
import { ClansService } from './clans.service';

@Global()
@Module({
  controllers: [ClansController],
  providers: [ClansService, ClanMembersService, ClanActivityService],
  exports: [ClanMembersService, ClansService],
})
export class ClansModule {}

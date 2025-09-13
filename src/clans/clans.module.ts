import { Module } from '@nestjs/common';
import { ClanMembersService } from './clan-members.service';
import { ClansController } from './clans.controller';
import { ClansService } from './clans.service';

@Module({
  controllers: [ClansController],
  providers: [ClansService, ClanMembersService],
  exports: [ClanMembersService],
})
export class ClansModule {}

import { ClashClientModule } from '@app/clash-client';
import { Module } from '@nestjs/common';
import { ClanMembersExportsService } from './clan-members-export.service';
import { ClanWarsExportsService } from './clan-wars-export.service';
import { ExportsController } from './exports.controller';
import { GoogleSheetService } from './google-sheet.service';

@Module({
  imports: [ClashClientModule],
  providers: [ClanWarsExportsService, ClanMembersExportsService, GoogleSheetService],
  controllers: [ExportsController],
})
export class ExportsModule {}

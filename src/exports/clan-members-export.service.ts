import { ClashClientService } from '@app/clash-client';
import { Collections } from '@app/constants';
import { ClanStoresEntity, ClanWarsEntity, SheetType } from '@app/entities';
import { Inject, Injectable } from '@nestjs/common';
import { Collection } from 'mongodb';
import { ClanMembersExportInput } from './dto/clan-members-export.dto';
import { CreateGoogleSheet, GoogleSheetService } from './google-sheet.service';

@Injectable()
export class ClanMembersExportsService {
  public constructor(
    @Inject(Collections.CLAN_WARS)
    private clanWarsRepository: Collection<ClanWarsEntity>,

    @Inject(Collections.CLAN_STORES)
    private clansRepository: Collection<ClanStoresEntity>,

    private coc: ClashClientService,
    private googleSheetService: GoogleSheetService,
  ) {}

  public async exec(input: ClanMembersExportInput) {
    const clans = await this.clansRepository
      .find({ guild: input.guildId, tag: { $in: input.clanTags } })
      .toArray();

    const sheets: CreateGoogleSheet[] = [];

    const result = await this.googleSheetService.createOrUpdateSheet({
      clans,
      guildId: input.guildId,
      label: 'Clan Wars Export',
      sheets,
      sheetType: SheetType.CLAN_MEMBERS,
    });

    return result;
  }
}

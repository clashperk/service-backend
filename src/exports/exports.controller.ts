import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClanMembersExportsService } from './clan-members-export.service';
import { ClanWarsExportsService } from './clan-wars-export.service';
import { ClanWarsExportInput } from './dto/clan-wars-export.dto';
import { ClanMembersExportInput } from './dto/clan-members-export.dto';

@ApiTags('EXPORTS')
@ApiBearerAuth()
// @UseGuards(JwtAuthGuard, RolesGuard)
@Controller('/exports')
export class ExportsController {
  public constructor(
    private clanWarsExportsService: ClanWarsExportsService,
    private clanMembersExportsService: ClanMembersExportsService,
  ) {}

  @Post('/clan-wars-export')
  public async getClanWarsExport(@Body() body: ClanWarsExportInput) {
    return this.clanWarsExportsService.exec(body);
  }

  @Post('/clan-members-export')
  public async getClanMembersExport(@Body() body: ClanMembersExportInput) {
    return this.clanMembersExportsService.exec(body);
  }
}

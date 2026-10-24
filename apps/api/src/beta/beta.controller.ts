import { ApiExcludeRoute, ApiKeyAuth } from '@app/decorators';
import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ApiKeyGuard,
  CurrentUser,
  JwtAuthGuard,
  JwtUser,
  Roles,
  RolesGuard,
  UserRoles,
} from '../auth';
import { BetaService } from './beta.service';
import { AddBetaGuildsInput, BetaGuildIdsDto, BetaGuildsDto } from './dto/beta-guilds.dto';
import { ApiTag } from '../api-tags';

@ApiTags(ApiTag.ADMIN)
@Controller('/admin/beta-guilds')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles([UserRoles.ADMIN])
@ApiBearerAuth()
export class BetaAdminController {
  constructor(private readonly betaService: BetaService) {}

  @Get()
  listBetaGuilds(): Promise<BetaGuildsDto> {
    return this.betaService.list();
  }

  @Post()
  addBetaGuilds(
    @Body() body: AddBetaGuildsInput,
    @CurrentUser() user: JwtUser,
  ): Promise<BetaGuildsDto> {
    return this.betaService.add({
      guildIds: body.guildIds,
      note: body.note ?? null,
      addedBy: user.userId,
    });
  }

  @Delete('/:guildId')
  removeBetaGuild(@Param('guildId') guildId: string): Promise<BetaGuildsDto> {
    return this.betaService.remove(guildId);
  }
}

/** For the bot's command-registration workflow, which registers beta commands per server. */
@ApiTags(ApiTag.INTERNAL)
@Controller('/beta-guilds')
export class BetaInternalController {
  constructor(private readonly betaService: BetaService) {}

  @Get('/ids')
  @UseGuards(ApiKeyGuard)
  @ApiKeyAuth()
  @ApiExcludeRoute()
  listBetaGuildIds(): Promise<BetaGuildIdsDto> {
    return this.betaService.listIds();
  }
}

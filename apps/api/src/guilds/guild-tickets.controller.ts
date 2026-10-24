import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtAuthGuard, JwtUser, Roles, RolesGuard, UserRoles } from '../auth';
import {
  CreateTicketPanelInput,
  CreateTicketTypeInput,
  GuildCategoryDto,
  ReorderTicketTypesInput,
  TicketPanelInput,
  TicketSavedRepliesInput,
  TicketsDto,
  TicketTypeInput,
} from './dto';
import { GuildDiscordService } from './guild-discord.service';
import { GuildTicketsService } from './guild-tickets.service';
import { ApiTag } from '../api-tags';

@ApiTags(ApiTag.GUILDS)
@Controller('/guilds/:guildId')
@ApiBearerAuth()
@Roles([UserRoles.USER])
@UseGuards(JwtAuthGuard, RolesGuard)
export class GuildTicketsController {
  constructor(
    private readonly tickets: GuildTicketsService,
    private readonly discord: GuildDiscordService,
  ) {}

  @Get('/categories')
  listCategories(
    @Param('guildId') guildId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<GuildCategoryDto[]> {
    return this.discord.listCategories({ guildId, applicationId: user.applicationId || null });
  }

  @Get('/tickets')
  getTickets(@Param('guildId') guildId: string): Promise<TicketsDto> {
    return this.tickets.get(guildId);
  }

  @Post('/tickets/panels')
  createTicketPanel(
    @Param('guildId') guildId: string,
    @Body() body: CreateTicketPanelInput,
    @CurrentUser() user: JwtUser,
  ): Promise<TicketsDto> {
    return this.tickets.createPanel(this.ctx(guildId, user), body);
  }

  @Patch('/tickets/panels/:panelId')
  updateTicketPanel(
    @Param('guildId') guildId: string,
    @Param('panelId') panelId: string,
    @Body() body: TicketPanelInput,
    @CurrentUser() user: JwtUser,
  ): Promise<TicketsDto> {
    return this.tickets.updatePanel(this.ctx(guildId, user), panelId, body);
  }

  @Delete('/tickets/panels/:panelId')
  deleteTicketPanel(
    @Param('guildId') guildId: string,
    @Param('panelId') panelId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<TicketsDto> {
    return this.tickets.deletePanel(this.ctx(guildId, user), panelId);
  }

  @Post('/tickets/panels/:panelId/types')
  addTicketType(
    @Param('guildId') guildId: string,
    @Param('panelId') panelId: string,
    @Body() body: CreateTicketTypeInput,
    @CurrentUser() user: JwtUser,
  ): Promise<TicketsDto> {
    return this.tickets.addType(this.ctx(guildId, user), panelId, body);
  }

  @Put('/tickets/panels/:panelId/types/order')
  reorderTicketTypes(
    @Param('guildId') guildId: string,
    @Param('panelId') panelId: string,
    @Body() body: ReorderTicketTypesInput,
    @CurrentUser() user: JwtUser,
  ): Promise<TicketsDto> {
    return this.tickets.reorderTypes(this.ctx(guildId, user), panelId, body.typeIds);
  }

  @Patch('/tickets/panels/:panelId/types/:typeId')
  updateTicketType(
    @Param('guildId') guildId: string,
    @Param('panelId') panelId: string,
    @Param('typeId') typeId: string,
    @Body() body: TicketTypeInput,
    @CurrentUser() user: JwtUser,
  ): Promise<TicketsDto> {
    return this.tickets.updateType(this.ctx(guildId, user), panelId, typeId, body);
  }

  @Delete('/tickets/panels/:panelId/types/:typeId')
  deleteTicketType(
    @Param('guildId') guildId: string,
    @Param('panelId') panelId: string,
    @Param('typeId') typeId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<TicketsDto> {
    return this.tickets.deleteType(this.ctx(guildId, user), panelId, typeId);
  }

  @Put('/tickets/saved-replies')
  saveTicketReplies(
    @Param('guildId') guildId: string,
    @Body() body: TicketSavedRepliesInput,
    @CurrentUser() user: JwtUser,
  ): Promise<TicketsDto> {
    return this.tickets.saveReplies(this.ctx(guildId, user), body.savedReplies);
  }

  private ctx(guildId: string, user: JwtUser): { guildId: string; applicationId: string | null } {
    return { guildId, applicationId: user.applicationId || null };
  }
}

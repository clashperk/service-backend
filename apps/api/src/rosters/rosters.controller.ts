import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, Roles, RolesGuard, UserRoles } from '../auth';
import { RostersEntity } from '../db';
import {
  AddRosterMembersDto,
  AddRosterMembersInput,
  CloneRosterInput,
  RemoveMembersBulkInput,
  RosterGroupInput,
  RosterGroupUpdateInput,
  RosterInput,
  RosterPlayerCheckDto,
  RosterTagsInput,
  RosterUpdateInput,
  TransferRosterMembersDto,
  TransferRosterMembersInput,
} from './dto';
import { GetRostersDto } from './dto/rosters.dto';
import { RostersService } from './rosters.service';

@Controller('/rosters')
@ApiBearerAuth()
@Roles([UserRoles.USER])
@UseGuards(JwtAuthGuard, RolesGuard)
export class RostersController {
  constructor(private rostersService: RostersService) {}

  @Get('/:guildId/list')
  @Roles([UserRoles.USER, UserRoles.FETCH_ROSTERS])
  getRosters(@Param('guildId') guildId: string): Promise<GetRostersDto> {
    return this.rostersService.getRosters(guildId);
  }

  @Post('/:guildId/create')
  createRoster(
    @Param('guildId') guildId: string,
    @Body() body: RosterInput,
  ): Promise<RostersEntity> {
    return this.rostersService.createRoster(guildId, body);
  }

  // Group routes come before the `/:rosterId` ones so "groups" is never read as a roster ID.
  @Post('/:guildId/groups')
  createRosterGroup(
    @Param('guildId') guildId: string,
    @Body() body: RosterGroupInput,
  ): Promise<GetRostersDto> {
    return this.rostersService.createGroup(guildId, body);
  }

  @Patch('/:guildId/groups/:groupId')
  updateRosterGroup(
    @Param('guildId') guildId: string,
    @Param('groupId') groupId: string,
    @Body() body: RosterGroupUpdateInput,
  ): Promise<GetRostersDto> {
    return this.rostersService.updateGroup(guildId, groupId, body);
  }

  @Delete('/:guildId/groups/:groupId')
  deleteRosterGroup(
    @Param('guildId') guildId: string,
    @Param('groupId') groupId: string,
  ): Promise<GetRostersDto> {
    return this.rostersService.deleteGroup(guildId, groupId);
  }

  @Get('/:guildId/:rosterId')
  getRoster(
    @Param('rosterId') rosterId: string,
    @Param('guildId') guildId: string,
  ): Promise<RostersEntity> {
    return this.rostersService.getRoster({ rosterId, guildId });
  }

  @Patch('/:guildId/:rosterId')
  updateRoster(
    @Param('guildId') guildId: string,
    @Param('rosterId') rosterId: string,
    @Body() body: RosterUpdateInput,
  ): Promise<RostersEntity> {
    return this.rostersService.updateRoster(guildId, rosterId, body);
  }

  @Delete('/:guildId/:rosterId')
  @HttpCode(204)
  async deleteRoster(
    @Param('guildId') guildId: string,
    @Param('rosterId') rosterId: string,
  ): Promise<void> {
    await this.rostersService.deleteRoster(guildId, rosterId);
  }

  @Post('/:guildId/:rosterId/clone')
  cloneRoster(
    @Param('guildId') guildId: string,
    @Param('rosterId') rosterId: string,
    @Body() body: CloneRosterInput,
  ): Promise<RostersEntity> {
    return this.rostersService.cloneRoster(guildId, rosterId, body.name);
  }

  @Post('/:guildId/:rosterId/members/check')
  @HttpCode(200)
  checkRosterMembers(
    @Param('guildId') guildId: string,
    @Param('rosterId') rosterId: string,
    @Body() body: RosterTagsInput,
  ): Promise<RosterPlayerCheckDto[]> {
    return this.rostersService.checkMembers({ guildId, rosterId, playerTags: body.playerTags });
  }

  @Put('/:guildId/:rosterId/members')
  addRosterMembers(
    @Param('guildId') guildId: string,
    @Param('rosterId') rosterId: string,
    @Body() body: AddRosterMembersInput,
  ): Promise<AddRosterMembersDto> {
    return this.rostersService.addMembers({ guildId, rosterId, ...body });
  }

  @Delete('/:guildId/:rosterId/members')
  deleteRosterMembers(
    @Param('rosterId') rosterId: string,
    @Param('guildId') guildId: string,
    @Body() body: RemoveMembersBulkInput,
  ): Promise<RostersEntity> {
    return this.rostersService.deleteRosterMembers({
      rosterId,
      guildId,
      playerTags: body.playerTags,
    });
  }

  @Post('/:guildId/:rosterId/members/refresh')
  refreshRosterMembers(
    @Param('guildId') guildId: string,
    @Param('rosterId') rosterId: string,
  ): Promise<RostersEntity> {
    return this.rostersService.refreshMembers(guildId, rosterId);
  }

  @Put('/:guildId/:rosterId/members/transfer')
  transferRosterMembers(
    @Param('rosterId') rosterId: string,
    @Param('guildId') guildId: string,
    @Body() body: TransferRosterMembersInput,
  ): Promise<TransferRosterMembersDto> {
    return this.rostersService.transferRosterMembers({
      ...body,
      rosterId,
      guildId,
    });
  }
}

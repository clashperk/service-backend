import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, Roles, RolesGuard, UserRoles } from '../auth';
import { RostersEntity } from '../db';
import {
  RemoveMembersBulkInput,
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
  getRosters(@Param('guildId') guildId: string): Promise<GetRostersDto> {
    return this.rostersService.getRosters(guildId);
  }

  @Post('/:guildId/create')
  createRoster(@Param('rosterId') rosterId: string): unknown {
    return Promise.resolve({ rosterId });
  }

  @Get('/:guildId/:rosterId')
  getRoster(
    @Param('rosterId') rosterId: string,
    @Param('guildId') guildId: string,
  ): Promise<RostersEntity> {
    return this.rostersService.getRoster({ rosterId, guildId });
  }

  @Patch('/:guildId/:rosterId')
  updateRoster(@Param('rosterId') rosterId: string): unknown {
    return Promise.resolve({ rosterId });
  }

  @Delete('/:guildId/:rosterId')
  deleteRoster(@Param('rosterId') rosterId: string): unknown {
    return Promise.resolve({ rosterId });
  }

  @Post('/:guildId/:rosterId/clone')
  cloneRoster(@Param('rosterId') rosterId: string): unknown {
    return Promise.resolve({ rosterId });
  }

  @Put('/:guildId/:rosterId/members')
  addRosterMembers(@Param('rosterId') rosterId: string): unknown {
    return Promise.resolve({ rosterId });
  }

  @Delete('/:guildId/:rosterId/members')
  deleteRosterMembers(
    @Param('rosterId') rosterId: string,
    @Param('guildId') guildId: string,
    @Body() body: RemoveMembersBulkInput,
  ): unknown {
    return this.rostersService.deleteRosterMembers({
      rosterId,
      guildId,
      playerTags: body.playerTags,
    });
  }

  @Post('/:guildId/:rosterId/members/refresh')
  refreshRosterMembers(@Param('rosterId') rosterId: string): unknown {
    return Promise.resolve({ rosterId });
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

import { JwtAuthGuard, Role, Roles, RolesGuard } from '@app/auth';
import { RostersEntity } from '@app/entities';
import { Body, Controller, Delete, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RemoveMembersBulkInput, SwapCategoryBulkInput, SwapRosterBulkInput } from './dto';
import { RostersService } from './rosters.service';

@Controller('/rosters')
@ApiTags('ROSTERS')
@ApiBearerAuth()
@Roles(Role.USER)
@UseGuards(JwtAuthGuard, RolesGuard)
export class RostersController {
  constructor(private rostersService: RostersService) {}

  @Get('/:rosterId')
  @ApiOperation({ summary: '(Internal)' })
  @ApiResponse({ type: RostersEntity, status: 200 })
  async getRoster(@Param('rosterId') rosterId: string) {
    return this.rostersService.getRoster(rosterId);
  }

  @Put('/:rosterId/change-category')
  @ApiOperation({ summary: '(Internal)' })
  @ApiResponse({ type: RostersEntity, status: 200 })
  async swapCategory(@Param('rosterId') rosterId: string, @Body() body: SwapCategoryBulkInput) {
    return this.rostersService.swapCategory({
      newCategoryId: body.categoryId,
      playerTags: body.playerTags,
      rosterId,
    });
  }

  @Put('/:rosterId/change-roster')
  @ApiOperation({ summary: '(Internal)' })
  @ApiResponse({ type: RostersEntity, status: 200 })
  async swapRoster(@Param('rosterId') rosterId: string, @Body() body: SwapRosterBulkInput) {
    return this.rostersService.swapRoster({
      categoryId: body.categoryId,
      rosterId,
      newRosterId: body.rosterId,
      playerTags: body.playerTags,
    });
  }

  @Delete('/:rosterId/members')
  @ApiOperation({ summary: '(Internal)' })
  @ApiResponse({ type: RostersEntity, status: 200 })
  async removeMembers(@Param('rosterId') rosterId: string, @Body() body: RemoveMembersBulkInput) {
    return this.rostersService.removeMembers({
      rosterId,
      playerTags: body.playerTags,
    });
  }
}

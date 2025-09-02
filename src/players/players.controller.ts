import { Cache } from '@app/decorators';
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, Roles, UserRoles } from '../auth';
import { AttackHistoryInputDto } from './dto';
import { PlayersService } from './players.service';

@Controller('/players')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class PlayersController {
  constructor(private playersService: PlayersService) {}

  @Get('/:playerTag/wars')
  @Cache(600)
  @Roles(UserRoles.DEV, UserRoles.FETCH_PLAYERS)
  clanWarAttackLog(@Param('playerTag') playerTag: string, @Query() query: AttackHistoryInputDto) {
    return this.playersService.clanWarAttackLog({ playerTag, months: query.months });
  }
}

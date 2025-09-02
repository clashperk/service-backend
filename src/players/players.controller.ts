import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, Roles, UserRoles } from '../auth';
import { PlayersService } from './players.service';

@Controller('/players')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class PlayersController {
  constructor(private playersService: PlayersService) {}

  @Get('/:playerTag/wars')
  @Roles(UserRoles.DEV, UserRoles.FETCH_PLAYERS)
  clanWarAttackLog(@Param('playerTag') playerTag: string) {
    return this.playersService.clanWarAttackLog({ playerTag, months: 1 });
  }
}

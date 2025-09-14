import { Cache } from '@app/decorators';
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth';
import { AttackHistoryInputDto } from './dto';
import { PlayersService } from './players.service';

@Controller('/players')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class PlayersController {
  constructor(private playersService: PlayersService) {}

  @Get('/:playerTag/wars')
  @Cache(600)
  getAttackHistory(@Param('playerTag') playerTag: string, @Query() query: AttackHistoryInputDto) {
    return this.playersService.getAttackHistory({ playerTag, startDate: query.startDate });
  }

  @Get('/:playerTag/wars/aggregate')
  @Cache(600)
  aggregateAttackHistory(
    @Param('playerTag') playerTag: string,
    @Query() query: AttackHistoryInputDto,
  ) {
    return this.playersService.aggregateAttackHistory({ playerTag, startDate: query.startDate });
  }
}

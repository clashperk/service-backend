import { Cache } from '@app/decorators';
import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth';
import { GameEventDto, GameEventsDto, GameEventsInputDto, UpcomingEventsDto } from './dto';
import { eventsBetween, GameEvent, upcomingEvents } from './game-calendar';
import { ApiTag } from '../api-tags';

const MAX_RANGE = 100 * 24 * 60 * 60 * 1000;

const withState = (event: GameEvent, now: Date): GameEventDto => ({
  ...event,
  state: now >= event.endTime ? 'ended' : now >= event.startTime ? 'active' : 'upcoming',
});

@ApiTags(ApiTag.EVENTS)
@Controller('/events')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EventsController {
  @Get('/')
  @Cache(60)
  getEvents(@Query() { from, to }: GameEventsInputDto): GameEventsDto {
    if (to <= from || to - from > MAX_RANGE) {
      throw new BadRequestException('`to` must be after `from` and at most 100 days later.');
    }
    const now = new Date();
    return {
      items: eventsBetween(new Date(from), new Date(to)).map((event) => withState(event, now)),
    };
  }

  @Get('/upcoming')
  @Cache(60)
  getUpcomingEvents(): UpcomingEventsDto {
    const now = new Date();
    return { items: upcomingEvents(now).map((event) => withState(event, now)) };
  }
}

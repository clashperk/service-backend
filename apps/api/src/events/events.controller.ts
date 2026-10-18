import { Cache } from '@app/decorators';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth';
import { UpcomingEventsDto } from './dto';
import { upcomingEvents } from './game-calendar';

@Controller('/events')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EventsController {
  @Get('/upcoming')
  @Cache(60)
  getUpcomingEvents(): UpcomingEventsDto {
    const now = new Date();
    return {
      items: upcomingEvents(now).map((event) => ({
        ...event,
        state: now >= event.startTime ? 'active' : 'upcoming',
      })),
    };
  }
}

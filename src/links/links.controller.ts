import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards';

@Controller('/links')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class LinksController {
  constructor() {}

  @Get('/:playerTag')
  getPlayerTag() {
    return Promise.resolve({});
  }
}

import { JwtAuthGuard } from '@app/auth';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('CLANS')
@ApiBearerAuth()
@Controller('/clans')
@UseGuards(JwtAuthGuard)
export class ClansController {
  @Get()
  getHello() {
    return {};
  }
}

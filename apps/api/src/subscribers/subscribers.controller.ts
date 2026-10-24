import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, Roles, RolesGuard, UserRoles } from '../auth';
import { SubscribersDto } from './dto/subscribers.dto';
import { SubscribersService } from './subscribers.service';
import { ApiTag } from '../api-tags';

@ApiTags(ApiTag.ADMIN)
@Controller('/admin/subscribers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles([UserRoles.ADMIN])
@ApiBearerAuth()
export class SubscribersController {
  constructor(private readonly subscribersService: SubscribersService) {}

  @Get()
  listSubscribers(): Promise<SubscribersDto> {
    return this.subscribersService.list();
  }
}

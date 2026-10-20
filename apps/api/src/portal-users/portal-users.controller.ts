import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, Roles, RolesGuard, UserRoles } from '../auth';
import { AddedPortalUserDto, AddPortalUserInput, PortalUsersDto } from './dto/portal-users.dto';
import { PortalUsersService } from './portal-users.service';

@Controller('/admin/portal-users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles([UserRoles.ADMIN])
@ApiBearerAuth()
export class PortalUsersController {
  constructor(private readonly portalUsersService: PortalUsersService) {}

  @Get()
  listPortalUsers(): Promise<PortalUsersDto> {
    return this.portalUsersService.list();
  }

  @Post()
  addPortalUser(@Body() body: AddPortalUserInput): Promise<AddedPortalUserDto> {
    return this.portalUsersService.add(body);
  }
}

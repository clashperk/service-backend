import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, Roles, RolesGuard, UserRoles } from '../auth';
import {
  AddedPortalUserDto,
  AddPortalUserInput,
  EditPortalUserInput,
  PortalUserDto,
  PortalUsersDto,
} from './dto/portal-users.dto';
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

  @Patch('/:userId')
  editPortalUser(
    @Param('userId') userId: string,
    @Body() body: EditPortalUserInput,
  ): Promise<PortalUserDto> {
    return this.portalUsersService.edit(userId, body.roles);
  }

  @Delete('/:userId')
  revokePortalUser(@Param('userId') userId: string): Promise<PortalUsersDto> {
    return this.portalUsersService.revoke(userId);
  }
}

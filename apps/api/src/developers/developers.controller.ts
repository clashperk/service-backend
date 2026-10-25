import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, Roles, RolesGuard, UserRoles } from '../auth';
import {
  AddedDeveloperDto,
  AddDeveloperInput,
  EditDeveloperInput,
  DeveloperDto,
  DevelopersDto,
} from './dto/developers.dto';
import { DevelopersService } from './developers.service';
import { ApiTag } from '../api-tags';

@ApiTags(ApiTag.ADMIN)
@Controller('/admin/developers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles([UserRoles.ADMIN])
@ApiBearerAuth()
export class DevelopersController {
  constructor(private readonly developersService: DevelopersService) {}

  @Get()
  listDevelopers(): Promise<DevelopersDto> {
    return this.developersService.list();
  }

  @Post()
  addDeveloper(@Body() body: AddDeveloperInput): Promise<AddedDeveloperDto> {
    return this.developersService.add(body);
  }

  @Patch('/:userId')
  editDeveloper(
    @Param('userId') userId: string,
    @Body() body: EditDeveloperInput,
  ): Promise<DeveloperDto> {
    return this.developersService.edit(userId, body.roles);
  }

  @Delete('/:userId')
  revokeDeveloper(@Param('userId') userId: string): Promise<DevelopersDto> {
    return this.developersService.revoke(userId);
  }
}

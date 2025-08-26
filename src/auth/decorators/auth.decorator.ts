import { Type, UseGuards, applyDecorators } from '@nestjs/common';
import { IAuthGuard } from '@nestjs/passport';
import { UserRoles } from '../dto/roles.dto';
import { RolesGuard } from '../guards';
import { Roles } from './roles.decorator';

export function Auth(authGuard: Type<IAuthGuard>, roles: UserRoles[]): MethodDecorator {
  return applyDecorators(Roles(roles), UseGuards(authGuard, RolesGuard));
}

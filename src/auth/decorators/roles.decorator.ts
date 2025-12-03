import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';
import { UserRoles } from '../dto/user-roles.dto';

export const ROLES_METADATA = 'ROLES_METADATA';

export const Roles = (roles: UserRoles[]) => {
  return applyDecorators(
    SetMetadata(ROLES_METADATA, roles),
    ApiExtension('x-required-roles', roles),
  );
};

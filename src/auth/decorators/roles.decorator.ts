import { CustomDecorator, SetMetadata } from '@nestjs/common';
import { UserRoles } from '../dto/roles.dto';

export const ROLES_KEY = 'roles';

export const Roles = (roles: UserRoles[]): CustomDecorator<string> => SetMetadata(ROLES_KEY, roles);

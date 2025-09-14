import { SetMetadata } from '@nestjs/common';
import { UserRoles } from '../dto/user-roles.dto';

export const ROLES_METADATA = 'ROLES_METADATA';

export const Roles = (roles: UserRoles[]) => SetMetadata(ROLES_METADATA, roles);

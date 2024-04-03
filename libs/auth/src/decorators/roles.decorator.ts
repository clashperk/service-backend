import { CustomDecorator, SetMetadata } from '@nestjs/common';

export enum Role {
  USER = 'user',
  ADMIN = 'admin',
  VIEWER = 'viewer',
  MANAGE_LINKS = 'manage_links',
}

export const ROLES_KEY = 'roles';

export const Roles = (...roles: Role[]): CustomDecorator<string> => SetMetadata(ROLES_KEY, roles);

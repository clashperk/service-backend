import { Role } from '@app/auth';

export class PortalUsersEntity {
  userId: string;

  passKey: string;

  roles: Role[];
}

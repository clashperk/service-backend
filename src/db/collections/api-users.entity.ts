import { UserRoles } from '../../auth/dto';

export class ApiUsersEntity {
  userId: string;
  roles: UserRoles[];
}

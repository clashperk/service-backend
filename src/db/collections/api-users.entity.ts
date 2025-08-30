import { UserRoles } from '../../auth/dto';

export class ApiUsersEntity {
  userId: string;
  roles: UserRoles[];
  passKey: string;
  isBot: boolean;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

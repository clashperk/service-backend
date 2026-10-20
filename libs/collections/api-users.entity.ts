import { UserRoles } from '@app/dto';

/** An API portal account: it trades its passkey for a token with these roles. */
export class ApiUsersEntity {
  userId: string;
  roles: UserRoles[];
  passKey: string;
  isBot: boolean;
  displayName: string;
  username: string;
  createdAt: Date;
  updatedAt: Date;
  guildIds: string[];
  deletedAt: Date | null;
  lastLoginAt?: Date;
}

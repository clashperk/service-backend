import { EnumString } from '@app/decorators';
import { UserRoles } from '@app/dto';
import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, Matches } from 'class-validator';

/** Roles an admin can grant here; admin itself stays out of reach of the dashboard. */
export const GRANTABLE_ROLES = Object.values(UserRoles).filter((role) => role !== UserRoles.ADMIN);

export class EditPortalUserInput {
  @ApiProperty({ enum: UserRoles, enumName: 'UserRoles', isArray: true })
  @IsArray()
  @ArrayMinSize(1, { message: 'Pick at least one role.' })
  @ArrayMaxSize(GRANTABLE_ROLES.length)
  @IsIn(GRANTABLE_ROLES, {
    each: true,
    message: 'One of those roles can only be granted by an admin.',
  })
  roles: UserRoles[];
}

export class AddPortalUserInput extends EditPortalUserInput {
  @Matches(/^\d{17,20}$/, { message: 'Enter a Discord user ID (17 to 20 digits).' })
  userId: string;
}

/** A portal account without its passkey. */
export class PortalUserDto {
  userId: string;
  username: string;
  displayName: string;
  isBot: boolean;
  @EnumString(UserRoles, 'UserRoles', { isArray: true })
  roles: UserRoles[];
  /** Null for accounts made before it was recorded. */
  createdAt: Date | null;
  lastLoginAt: Date | null;
}

export class PortalUsersDto {
  users: PortalUserDto[];
}

export class AddedPortalUserDto {
  user: PortalUserDto;
  /** Shown once; the account signs in with it at /auth/login. */
  passKey: string;
}

import { ArrayMaxSize, IsArray, IsOptional, Matches } from 'class-validator';

/** Only the lists sent change; an empty list removes the role. */
export class ManagerRolesInput {
  /** Can use every command and this dashboard, like Manage Server. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(25)
  @Matches(/^\d{17,20}$/, { each: true })
  managerRoles?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(25)
  @Matches(/^\d{17,20}$/, { each: true })
  rosterManagerRoles?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(25)
  @Matches(/^\d{17,20}$/, { each: true })
  flagsManagerRoles?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(25)
  @Matches(/^\d{17,20}$/, { each: true })
  linksManagerRoles?: string[];
}

export class ManagerRolesDto {
  managerRoles: string[];
  rosterManagerRoles: string[];
  flagsManagerRoles: string[];
  linksManagerRoles: string[];
}

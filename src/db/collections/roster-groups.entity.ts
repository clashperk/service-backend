export class RosterGroupsEntity {
  displayName: string;
  name: string;
  guildId: string;
  selectable: boolean;
  roleId?: string | null;
  createdAt: Date;
}

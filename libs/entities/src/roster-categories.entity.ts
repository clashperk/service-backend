export class RosterCategoriesEntity {
  displayName: string;
  name: string;
  guildId: string;
  selectable: boolean;
  roleId?: string | null;
  createdAt: Date;
}

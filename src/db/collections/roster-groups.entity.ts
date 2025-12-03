import { ApiProperty } from '@nestjs/swagger';
import { ObjectId } from 'mongodb';

export class RosterGroupsEntity {
  @ApiProperty({ type: String })
  _id: ObjectId;

  displayName: string;
  name: string;
  guildId: string;
  selectable: boolean;
  roleId?: string | null;
  createdAt: Date;
}

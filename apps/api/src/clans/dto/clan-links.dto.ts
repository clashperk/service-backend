import { ApiProperty } from '@nestjs/swagger';

export class ClanLinkedMemberDto {
  name: string;
  tag: string;
  role: string;
  townHallLevel: number;

  @ApiProperty({ required: false, nullable: true, type: String })
  userId: string | null;

  @ApiProperty({ required: false, nullable: true, type: String })
  username: string | null;

  @ApiProperty({ required: false, nullable: true, type: String })
  displayName: string | null;

  verified: boolean;
  deletable: boolean;
}

export class ClanLinksDto {
  name: string;
  tag: string;
  members: number;
  memberList: ClanLinkedMemberDto[];
}

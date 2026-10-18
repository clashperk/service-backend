import { ClanWarDto } from '@app/clash-client/dto';
import { ApiProperty } from '@nestjs/swagger';

export class CurrentWarDto {
  /** False when the war log is private: regular wars are hidden then, CWL wars are not. */
  isWarLogPublic: boolean;

  /** The regular war, or the CWL round in war (else in preparation, else the last ended one). */
  @ApiProperty({ type: () => ClanWarDto, nullable: true })
  war: ClanWarDto | null;
}

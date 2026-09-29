import { ObjectIdValidator } from '@app/dto';
import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsNotEmpty, Validate, ValidateIf } from 'class-validator';
import { RostersEntity } from '../../db';

export class TransferRosterMembersInput {
  @IsArray()
  @ArrayMinSize(1)
  playerTags: string[];

  @ValidateIf((input) => !input.newGroupId)
  @Validate(ObjectIdValidator)
  @IsNotEmpty()
  @ApiProperty({ required: false, description: 'Required unless newGroupId is set.' })
  newRosterId?: string;

  @ValidateIf((input) => !input.newRosterId)
  @Validate(ObjectIdValidator)
  @IsNotEmpty()
  @ApiProperty({ required: false, description: 'Required unless newRosterId is set.' })
  newGroupId?: string;
}

export class TransferRosterMembersDto {
  roster: RostersEntity;
  result: {
    player: {
      name: string;
      tag: string;
    };
    success: boolean;
    message: string;
  }[];
}

import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsOptional,
  IsString,
  Validate,
  ValidateIf,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'EitherOrConstraint', async: false })
class EitherOrConstraint implements ValidatorConstraintInterface {
  validate() {
    return false;
  }

  defaultMessage() {
    return 'You can send either "playerTags" or "userIds", not both or none. Max size is 100.';
  }
}

export class CreateLinkInputDto {
  @IsString()
  playerTag: string;

  @IsString()
  userId: string;

  @IsOptional()
  @IsString()
  apiToken: string | null;
}

export class DeleteLinkInputDto {
  playerTag: string;
}

export class LinksDto {
  tag: string;

  name: string;

  userId: string;

  username: string;

  verified: boolean;
}

export class MessageOkDto {
  @ApiProperty({ nullable: false, required: true })
  message?: string;

  [key: string]: unknown;
}

export class GetLinksInputDto {
  @ValidateIf((body) => !!(body.playerTags && !body.userIds))
  @IsString({ each: true })
  @ArrayMaxSize(100)
  @ArrayMinSize(1)
  @ApiProperty({ example: ['#2PP'], required: false })
  playerTags: string[];

  @ValidateIf((body) => !!(body.userIds && !body.playerTags))
  @IsString({ each: true })
  @ArrayMaxSize(100)
  @ArrayMinSize(1)
  @ApiProperty({ example: ['444432489818357760'], required: false })
  userIds: string[];

  @ApiHideProperty()
  @ValidateIf(
    (body) =>
      !!(body.playerTags?.length && body.userIds?.length) ||
      !!(!body.playerTags?.length && !body.userIds?.length),
  )
  @Validate(EitherOrConstraint)
  private _: string;
}

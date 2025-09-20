import { Field, InputType, ObjectType } from '@nestjs/graphql';
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

@ObjectType()
export class LinksDto {
  @Field()
  tag: string;

  @Field()
  name: string;

  @Field()
  userId: string;

  @Field()
  username: string;

  @Field()
  verified: boolean;
}

@ObjectType()
export class MessageOkDto {
  @Field()
  message: string;
}

@InputType()
export class GetLinksInputDto {
  @Field(() => [String])
  @ValidateIf((body) => !!(body.playerTags && !body.userIds))
  @IsString({ each: true })
  @ArrayMaxSize(100)
  @ArrayMinSize(1)
  @ApiProperty({ example: ['#2PP'] })
  playerTags: string[];

  @Field(() => [String])
  @ValidateIf((body) => !!(body.userIds && !body.playerTags))
  @IsString({ each: true })
  @ArrayMaxSize(100)
  @ArrayMinSize(1)
  @ApiProperty({ example: ['444432489818357760'] })
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

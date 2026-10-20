import { EnumString } from '@app/decorators';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsUrl,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const nullable = () => ValidateIf((_, value) => value !== null && value !== undefined);
const imageLink = () =>
  IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'Images need a full https:// link.' },
  );

/** The messages `/setup buttons` posts. */
export enum ButtonType {
  LINK = 'link',
  REFRESH = 'refresh',
  MY_ROSTERS = 'myRosters',
}

export enum ButtonTokenField {
  REQUIRED = 'required',
  OPTIONAL = 'optional',
  HIDDEN = 'hidden',
}

export class ButtonMessageInput {
  @Transform(trim)
  @Length(1, 256)
  title: string;

  @Transform(trim)
  @Length(1, 2000)
  description: string;

  @nullable()
  @imageLink()
  @MaxLength(256)
  imageUrl?: string | null;

  @nullable()
  @imageLink()
  @MaxLength(256)
  thumbnailUrl?: string | null;

  /** RGB integer; null for none. */
  @nullable()
  @IsInt()
  @Min(0)
  @Max(0xffffff)
  color?: number | null;

  /** 1 blurple, 2 grey, 3 green, 4 red. */
  @IsInt()
  @IsIn([1, 2, 3, 4])
  buttonStyle: number;

  /** Link button only: whether members enter their player token. */
  @IsOptional()
  @EnumString(ButtonTokenField, 'ButtonTokenField', { required: false })
  tokenField?: ButtonTokenField;
}

export class ButtonMessageDto {
  title: string;
  description: string;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  color: number | null;
  buttonStyle: number;
  /** Set for the link button only. */
  @EnumString(ButtonTokenField, 'ButtonTokenField', { required: false })
  tokenField?: ButtonTokenField;
}

/** Null for a button never customized; the bot then uses its defaults. */
export class ButtonsDto {
  link: ButtonMessageDto | null;
  refresh: ButtonMessageDto | null;
  myRosters: ButtonMessageDto | null;
}

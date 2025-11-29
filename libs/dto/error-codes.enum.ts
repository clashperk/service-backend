import { EnumString } from '@app/decorators';

export enum ErrorCodes {
  FORBIDDEN = 'FORBIDDEN',
  UNAUTHORIZED = 'UNAUTHORIZED',
  NOT_FOUND = 'NOT_FOUND',
  BAD_REQUEST = 'BAD_REQUEST',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',

  HANDOFF_TOKEN_EXPIRED = 'HANDOFF_TOKEN_EXPIRED',
  USER_BLOCKED = 'USER_BLOCKED',
  INVALID_PASSKEY = 'INVALID_PASSKEY',
  GUILD_ACCESS_FORBIDDEN = 'GUILD_ACCESS_FORBIDDEN',
}

export class ErrorResponseDto {
  @EnumString(ErrorCodes, 'ErrorCodes', { example: 'string' })
  code: ErrorCodes;

  message: string;

  statusCode: number;

  method: string;

  path: string;
}

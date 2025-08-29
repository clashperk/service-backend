import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export function EnumString(enumType: object, enumName: string) {
  return applyDecorators(IsEnum(enumType), ApiProperty({ enum: enumType, enumName }));
}

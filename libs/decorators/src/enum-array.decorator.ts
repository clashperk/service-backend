import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export function EnumArray(enumType: object, enumName: string) {
  return applyDecorators(
    IsEnum(enumType, { each: true }),
    ApiProperty({
      isArray: true,
      enum: enumType,
      enumName,
      default: Object.values(enumType),
    }),
  );
}

import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptions } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export function EnumString(enumType: object, enumName: string, props?: ApiPropertyOptions) {
  return applyDecorators(
    IsEnum(enumType),
    ApiProperty({
      'enum': enumType,
      enumName,
      'x-enumNames': Object.keys(enumType).filter((k) => isNaN(Number(k))),
      ...props,
    }),
  );
}

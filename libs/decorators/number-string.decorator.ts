import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsNumber } from 'class-validator';

export function NumberString(defaultValue = 0) {
  return applyDecorators(
    Transform(({ value }) => {
      if (!value) return defaultValue;
      if (/^\d+$/.test(value)) return Number(value);
      return defaultValue;
    }),
    IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 0 }),
  );
}

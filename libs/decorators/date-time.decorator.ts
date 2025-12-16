import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber } from 'class-validator';
import moment from 'moment';

export function DateTime() {
  return applyDecorators(
    ApiProperty({
      description: 'Date string or timestamp in milliseconds',
      format: 'date-time',
      type: 'string',
    }),
    Transform(({ value }) => {
      if (!value) return null;
      if (/^\d+$/.test(value)) return Number(value);
      return moment(value).isValid() ? moment(value).toDate().getTime() : null;
    }),
    IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 0 }),
  );
}

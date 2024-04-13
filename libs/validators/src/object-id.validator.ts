import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { ObjectId } from 'mongodb';

@ValidatorConstraint({ name: 'ObjectIdValidator', async: false })
export class ObjectIdValidator implements ValidatorConstraintInterface {
  validate(value: string, _: ValidationArguments) {
    return ObjectId.isValid(value);
  }

  defaultMessage(args: ValidationArguments) {
    return `Invalid ${args.property}`;
  }
}

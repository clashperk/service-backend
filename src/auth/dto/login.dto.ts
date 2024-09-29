import { IsNotEmpty } from 'class-validator';

export class LoginInput {
  @IsNotEmpty()
  passkey: string;
}

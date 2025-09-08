import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class PlayerLinksEntity {
  @Field()
  userId: string;
  username: string;
  displayName: string;
  discriminator: string;
  tag: string;
  name: string;
  order: number;
  verified: boolean;
  source: 'bot' | 'web' | 'api';
  linkedBy: string;
  createdAt: Date;
  deleted?: boolean;
}

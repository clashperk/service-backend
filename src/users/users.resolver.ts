import { Query, Resolver } from '@nestjs/graphql';

@Resolver()
export class UsersResolver {
  constructor() {}

  @Query(() => Boolean)
  getUser() {
    return false;
  }
}

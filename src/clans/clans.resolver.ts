import { Query, Resolver } from '@nestjs/graphql';
import { UsersEntity } from 'src/rdb/entities';

@Resolver()
export class ClansResolver {
  @Query(() => UsersEntity)
  getClans() {}
}

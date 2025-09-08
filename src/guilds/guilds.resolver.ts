import { UseGuards } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from '../auth';
import { PlayerLinksEntity } from '../db';

@Resolver()
export class GuildsResolver {
  constructor() {}

  @Query(() => PlayerLinksEntity)
  @UseGuards(GqlAuthGuard)
  getGuild() {
    return {} as unknown as PlayerLinksEntity;
  }
}

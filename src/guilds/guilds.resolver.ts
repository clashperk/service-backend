import { UseGuards } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from '../auth';
import { SettingsEntity } from '../db/entities/settings.entity';

@Resolver()
export class GuildsResolver {
  constructor() {}

  @Query(() => SettingsEntity)
  @UseGuards(GqlAuthGuard)
  getGuild() {
    return { guildId: '1', name: 'Guild' } as SettingsEntity;
  }
}

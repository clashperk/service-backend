import { Query, Resolver } from '@nestjs/graphql';
import { SettingsEntity } from '../db/entities/settings.entity';

@Resolver()
export class GuildsResolver {
  constructor() {}

  @Query(() => SettingsEntity)
  getGuild() {
    return { guildId: '1', name: 'Guild' } as SettingsEntity;
  }
}

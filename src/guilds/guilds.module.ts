import { Module } from '@nestjs/common';
import { GuildsController } from './guilds.controller';
import { GuildsService } from './guilds.service';
import { GuildsResolver } from './guilds.resolver';

@Module({
  controllers: [GuildsController],
  providers: [GuildsService, GuildsResolver],
})
export class GuildsModule {}

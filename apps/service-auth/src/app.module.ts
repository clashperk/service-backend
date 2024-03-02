import { MongoDbModule } from '@app/mongodb';
import { RedisModule } from '@app/redis';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ClansModule } from './clans/clans.module';
import { GuildsModule } from './guilds/guilds.module';
import { LinksModule } from './links/links.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongoDbModule,
    RedisModule,
    ClansModule,
    AuthModule,
    GuildsModule,
    LinksModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

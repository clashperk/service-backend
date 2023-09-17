import { MongodbModule } from '@app/mongodb';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RedisModule } from '@app/redis';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), MongodbModule, RedisModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

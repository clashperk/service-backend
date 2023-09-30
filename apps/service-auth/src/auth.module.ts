import { MongodbModule } from '@app/mongodb';
import { RedisModule } from '@app/redis';
import { RestModule } from '@app/rest';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), MongodbModule, RedisModule, RestModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}

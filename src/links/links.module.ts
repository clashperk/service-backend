import { Module } from '@nestjs/common';
import { LinksController } from './links.controller';
import { LinksResolver } from './links.resolver';
import { LinksService } from './links.service';

@Module({
  controllers: [LinksController],
  providers: [LinksService, LinksResolver],
})
export class LinksModule {}

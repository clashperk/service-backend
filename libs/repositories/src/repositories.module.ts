import { Module } from '@nestjs/common';
import * as repositories from './';

@Module({
  providers: [...Object.values(repositories)],
  exports: [...Object.values(repositories)],
})
export class RepositoryModule {}

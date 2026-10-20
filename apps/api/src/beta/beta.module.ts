import { Global, Module } from '@nestjs/common';
import { BetaAdminController, BetaInternalController } from './beta.controller';
import { BetaService } from './beta.service';

@Global()
@Module({
  controllers: [BetaAdminController, BetaInternalController],
  providers: [BetaService],
  exports: [BetaService],
})
export class BetaModule {}

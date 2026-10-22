import { ApiExcludeTypings } from '@app/decorators';
import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiExcludeController, ApiExcludeEndpoint } from '@nestjs/swagger';

@Controller({
  path: '/',
  version: ['1', '2', VERSION_NEUTRAL],
})
@ApiExcludeController()
@ApiExcludeTypings()
export class AppController {
  @ApiExcludeEndpoint()
  @Get('/')
  getHello(): unknown {
    return 'Hello World!';
  }

  @Get('/health')
  getHealth(): unknown {
    return { message: 'Ok' };
  }
}

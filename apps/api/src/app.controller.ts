import { ApiExcludeTypings, Cache } from '@app/decorators';
import { Controller, Get, Post, Req, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiExcludeController, ApiExcludeEndpoint } from '@nestjs/swagger';

@Controller({
  path: '/',
  version: ['1', '2', VERSION_NEUTRAL],
})
@ApiExcludeController()
@ApiExcludeTypings()
export class AppController {
  constructor() {}

  @ApiExcludeEndpoint()
  @Get('/')
  getHello(): unknown {
    return 'Hello World!';
  }

  @Get('/health')
  getHealth(): unknown {
    return { message: 'Ok' };
  }

  @Post('/cache-status-check')
  @Cache(30)
  cacheStatusCheckPOST(@Req() req: Request): unknown {
    return {
      headers: { ...req.headers },
    };
  }

  @Get('/cache-status-check')
  @Cache(30)
  cacheStatusCheckGET(@Req() req: Request): unknown {
    return {
      headers: { ...req.headers },
    };
  }
}

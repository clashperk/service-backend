import { Config } from '@app/constants';
import { Cache } from '@app/decorators';
import { Controller, Get, Post, Req, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

@Controller({
  path: '/',
  version: ['1', '2', VERSION_NEUTRAL],
})
@ApiExcludeController(Config.IS_LOCAL)
export class AppController {
  constructor() {}

  @Get('/')
  getHello() {
    return 'Hello World!';
  }

  @Get('/health')
  getHealth() {
    return { message: 'Ok' };
  }

  @Post('/cache-status-check')
  @Cache(30)
  cacheStatusCheckPOST(@Req() req: Request) {
    return {
      headers: { ...req.headers },
    };
  }

  @Get('/cache-status-check')
  @Cache(30)
  cacheStatusCheckGET(@Req() req: Request) {
    return {
      headers: { ...req.headers },
    };
  }
}

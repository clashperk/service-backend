import { Config } from '@app/constants';
import { Cache } from '@app/decorators';
import { Controller, Get, Param, Post, Req, Res, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Response } from 'express';

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

  @Get('/swagger/:apiKey')
  swaggerAuth(@Res() res: Response, @Param('apiKey') apiKey: string) {
    res.cookie('x-api-key', apiKey);
    res.redirect('/docs');
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

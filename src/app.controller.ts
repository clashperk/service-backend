import { Cache } from '@app/decorators';
import { Controller, Get, Post, Query, Req, Res, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiExcludeController, ApiExcludeEndpoint, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';

@Controller({
  path: '/',
  version: ['1', '2', VERSION_NEUTRAL],
})
@ApiExcludeController()
export class AppController {
  constructor() {}

  @Get('/')
  @ApiExcludeEndpoint()
  getHello(): string {
    return 'Hello World!';
  }

  @Get('/health')
  @ApiResponse({
    status: 200,
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'OK',
        },
      },
    },
  })
  getHealth() {
    return { message: 'Ok' };
  }

  @Post('/cloudflare-cache-status-check')
  @Cache(30)
  POSTcloudflareCacheStatusCheck(@Req() req: Request) {
    return Promise.resolve({
      'timestamp': new Date().toISOString(),
      'headers': { ...req.headers },
      'authorization': req.headers['authorization'] || null,
      'x-access-token': req.headers['x-access-token'] || null,
    });
  }

  @Get('/cloudflare-cache-status-check')
  GETcloudflareCacheStatusCheck(
    @Req() req: Request,
    @Res() res: Response,
    @Query('cache-control') cache: string,
  ) {
    if (cache) res.setHeader('Cache-Control', cache);

    return res.json({
      'cache': cache || null,
      'headers': { ...req.headers },
      'authorization': req.headers['authorization'] || null,
      'x-access-token': req.headers['x-access-token'] || null,
    });
  }
}

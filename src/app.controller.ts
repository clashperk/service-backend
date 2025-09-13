import { Cache } from '@app/decorators';
import { Controller, Get, Post, Req, Res, VERSION_NEUTRAL } from '@nestjs/common';
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

  @Post('/cache-status-check')
  @Cache(30)
  POSTcloudflareCacheStatusCheck(@Req() req: Request) {
    return {
      'req-headers': { ...req.headers },
    };
  }

  @Get('/cache-status-check')
  GETcloudflareCacheStatusCheck(@Req() req: Request, @Res() res: Response) {
    res.setHeader('Cache-Control', 'max-age=30');

    return res.json({
      'req-headers': { ...req.headers },
    });
  }
}

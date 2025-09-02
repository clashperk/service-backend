import { Cache } from '@app/decorators';
import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { ApiExcludeController, ApiExcludeEndpoint, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';

@Controller('/')
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

  @Get('/cloudflare-cache-status-check')
  @Cache(30)
  async cloudflareCacheStatusCheck(@Req() req: Request) {
    return Promise.resolve({
      'authorization': req.headers['authorization'] || null,
      'x-access-token': req.headers['x-access-token'] || null,
    });
  }

  @Get('/cloudflare-cache-status-check-custom')
  cloudflareCacheStatusCheck1(
    @Req() req: Request,
    @Res() res: Response,
    @Query('cacheControl') cacheControl: string,
  ) {
    if (cacheControl) res.setHeader('Cache-Control', cacheControl);

    return res.json({
      cacheControl,
      'authorization': req.headers['authorization'] || null,
      'x-access-token': req.headers['x-access-token'] || null,
    });
  }
}

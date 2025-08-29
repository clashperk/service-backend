import { Cache } from '@app/decorators';
import { Controller, Get, Req } from '@nestjs/common';
import { ApiExcludeController, ApiExcludeEndpoint, ApiResponse } from '@nestjs/swagger';

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
}

import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifyKeyMiddleware } from 'discord-interactions';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class InteractionMiddleware implements NestMiddleware {
  constructor(private configService: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const publicKey = this.configService.getOrThrow<string>('DISCORD_PUBLIC_KEY');
    verifyKeyMiddleware(publicKey)(req, res, next);
  }
}

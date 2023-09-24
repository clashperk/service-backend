import { Injectable } from '@nestjs/common';

@Injectable()
export class ClansService {
  getHello(): string {
    return 'Hello World!';
  }
}

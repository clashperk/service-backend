import { Injectable } from '@nestjs/common';

@Injectable()
export class WarsService {
  getHello(): string {
    return 'Hello World!';
  }
}

import { Injectable } from '@nestjs/common';

@Injectable()
export class ServiceClansService {
  getHello(): string {
    return 'Hello World!';
  }
}

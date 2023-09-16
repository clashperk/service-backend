import { Injectable } from '@nestjs/common';

@Injectable()
export class ServiceWarsService {
  getHello(): string {
    return 'Hello World!';
  }
}

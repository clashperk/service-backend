import { Injectable } from '@nestjs/common';

@Injectable()
export class ServiceCapitalService {
  getHello(): string {
    return 'Hello World!';
  }
}

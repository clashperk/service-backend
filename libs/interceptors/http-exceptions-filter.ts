import { ErrorCodes } from '@app/dto';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

const ErrorCodesMap = Object.fromEntries(
  Object.entries(ErrorCodes).map(([key, value]) => [value, key]),
) as Record<string, keyof typeof ErrorCodes>;

@Catch()
export class HttpExceptionsFilter implements ExceptionFilter {
  private logger = new Logger('ExceptionsHandler');

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    if (!(exception instanceof HttpException)) this.logger.error(exception);

    const status: HttpStatus = exception.getStatus?.() || HttpStatus.INTERNAL_SERVER_ERROR;
    const error = exception.getResponse?.();

    if (error?.['message'] && ErrorCodesMap[error['message']]) {
      error['code'] = error['message'];
      if (error['error']) error['message'] = error['error'];
    }

    const message: string = Array.isArray(error?.['message'])
      ? error['message'].join(', ')
      : typeof error === 'string'
        ? error
        : (error?.['message'] ?? exception.message);

    return res.status(status).json({
      code: error?.['code'] || HttpStatus[status],
      message,
      statusCode: status,
      method: req.method,
      path: req.url,
    });
  }

  getErrorCode(status: HttpStatus) {
    return HttpStatus[status];
  }
}

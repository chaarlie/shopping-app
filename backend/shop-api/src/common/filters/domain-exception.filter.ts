import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ConflictError, NotFoundError } from '../errors.js';

@Catch(NotFoundError, ConflictError)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: NotFoundError | ConflictError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const [statusCode, error] =
      exception instanceof NotFoundError
        ? [HttpStatus.NOT_FOUND, 'Not Found']
        : [HttpStatus.CONFLICT, 'Conflict'];

    response.status(statusCode).json({
      statusCode,
      error,
      message: exception.message,
    });
  }
}

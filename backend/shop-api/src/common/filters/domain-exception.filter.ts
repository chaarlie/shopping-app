import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ConflictError, NotFoundError, ValidationError } from '../errors.js';

type DomainError = NotFoundError | ConflictError | ValidationError;

const statusFor = (exception: DomainError): [HttpStatus, string] => {
  if (exception instanceof NotFoundError) {
    return [HttpStatus.NOT_FOUND, 'Not Found'];
  }

  if (exception instanceof ConflictError) {
    return [HttpStatus.CONFLICT, 'Conflict'];
  }

  return [HttpStatus.BAD_REQUEST, 'Bad Request'];
};

@Catch(NotFoundError, ConflictError, ValidationError)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const [statusCode, error] = statusFor(exception);

    response.status(statusCode).json({
      statusCode,
      error,
      message: exception.message,
    });
  }
}

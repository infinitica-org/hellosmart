import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ProblemDetailsException } from './problem-details.exception.js';

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const instance = request.url;

    if (exception instanceof ProblemDetailsException) {
      const problem = exception.problem;
      response
        .status(problem.status)
        .header('content-type', 'application/problem+json')
        .send({
          type: problem.type ?? `https://hellosmart.ai/errors/${problem.code.toLowerCase().replace(/_/g, '-')}`,
          title: problem.title,
          status: problem.status,
          detail: problem.detail,
          code: problem.code,
          instance,
          ...(problem.invalidParams ? { invalidParams: problem.invalidParams } : {}),
        });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const detail =
        typeof res === 'string'
          ? res
          : (res as any)?.message || exception.message || 'An error occurred';
      const code = (res as any)?.code || (status === 401 ? 'AUTH_REQUIRED' : status === 403 ? 'FORBIDDEN' : 'HTTP_ERROR');

      response
        .status(status)
        .header('content-type', 'application/problem+json')
        .send({
          type: `https://hellosmart.ai/errors/${code.toLowerCase().replace(/_/g, '-')}`,
          title: exception.name.replace(/Exception$/, ''),
          status,
          detail: Array.isArray(detail) ? detail.join(', ') : detail,
          code,
          instance,
        });
      return;
    }

    // Unhandled internal server error (never leak stack trace or internal error messages)
    const requestId =
      typeof request.id === 'string' ? request.id : undefined;
    if (exception instanceof Error) {
      this.logger.error(
        `Unhandled error on ${request.method} ${instance}${requestId ? ` [${requestId}]` : ''}: ${exception.message}`,
        exception.stack,
      );
    } else {
      this.logger.error(
        `Unhandled error on ${request.method} ${instance}${requestId ? ` [${requestId}]` : ''}: ${String(exception)}`,
      );
    }

    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .header('content-type', 'application/problem+json')
      .send({
        type: 'https://hellosmart.ai/errors/internal-server-error',
        title: 'Internal Server Error',
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        detail: 'An internal server error occurred.',
        code: 'INTERNAL_ERROR',
        instance,
      });
  }
}


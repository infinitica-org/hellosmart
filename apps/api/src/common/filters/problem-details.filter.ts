import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ProblemDetails } from '@hs/contracts';
import { isProblemDetails } from '../errors/app-http.exception.js';

function isHttpExceptionLike(exception: unknown): exception is HttpException {
  return (
    typeof exception === 'object' &&
    exception !== null &&
    'getStatus' in exception &&
    typeof (exception as HttpException).getStatus === 'function' &&
    'getResponse' in exception &&
    typeof (exception as HttpException).getResponse === 'function'
  );
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest & { requestId?: string }>();

    const requestId =
      typeof request.requestId === 'string' ? request.requestId : request.id;

    let problem: ProblemDetails;

    if (isHttpExceptionLike(exception)) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      if (isProblemDetails(response)) {
        problem = { ...response, requestId };
      } else {
        const detail =
          typeof response === 'string'
            ? response
            : typeof response === 'object' && response !== null && 'message' in response
              ? Array.isArray((response as { message: unknown }).message)
                ? (response as { message: string[] }).message.join('; ')
                : String((response as { message: unknown }).message)
              : 'Request failed';
        problem = {
          type: `https://hellosmart.ai/problems/http_${status}`,
          title: HttpStatus[status] ?? 'Error',
          status,
          detail,
          code:
            status === 401
              ? 'UNAUTHORIZED'
              : status === 403
                ? 'FORBIDDEN'
                : status === 429
                  ? 'RATE_LIMITED'
                  : 'HTTP_ERROR',
          requestId,
        };
      }
    } else {
      problem = {
        type: 'https://hellosmart.ai/problems/internal_error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
        requestId,
      };
    }

    void reply
      .status(problem.status)
      .header('content-type', 'application/problem+json')
      .send(problem);
  }
}

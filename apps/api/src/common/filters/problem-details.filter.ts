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

interface FastifyErrorLike {
  statusCode?: number;
  status?: number;
  code?: string;
  message?: string;
}

function isFastifyErrorLike(exception: unknown): exception is FastifyErrorLike {
  return (
    typeof exception === 'object' &&
    exception !== null &&
    ('statusCode' in exception || 'status' in exception || 'code' in exception)
  );
}

function containsSensitiveDetails(text: string): boolean {
  const sensitivePatterns = [
    /syntax error at or near/i,
    /violates .* constraint/i,
    /relation ".*" does not exist/i,
    /column ".*" does not exist/i,
    /pg_/i,
    /select\s+.*\s+from/i,
    /insert\s+into/i,
    /update\s+.*\s+set/i,
    /delete\s+from/i,
    /password/i,
    /secret/i,
    /stack\s*trace/i,
    /at\s+.*\s+\(.*\)/i,
  ];
  return sensitivePatterns.some((pattern) => pattern.test(text));
}

const HTTP_STATUS_TITLES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
};

function getTitleForStatus(status: number): string {
  return HTTP_STATUS_TITLES[status] ?? HttpStatus[status] ?? 'Error';
}

function getErrorCodeForStatus(status: number): string {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 413:
      return 'PAYLOAD_TOO_LARGE';
    case 415:
      return 'UNSUPPORTED_MEDIA_TYPE';
    case 422:
      return 'VALIDATION_ERROR';
    case 429:
      return 'RATE_LIMITED';
    default:
      return status >= 500 ? 'INTERNAL_ERROR' : 'HTTP_ERROR';
  }
}

function sanitizeDetail(detail: string): string {
  if (process.env.NODE_ENV === 'production' && containsSensitiveDetails(detail)) {
    return 'An error occurred while processing the request';
  }
  return detail;
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
        problem = {
          ...response,
          detail: sanitizeDetail(response.detail),
          requestId,
        };
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
          title: getTitleForStatus(status),
          status,
          detail: sanitizeDetail(detail),
          code: getErrorCodeForStatus(status),
          requestId,
        };
      }
    } else if (isFastifyErrorLike(exception)) {
      const statusCode = exception.statusCode ?? exception.status;
      const code = exception.code;

      if (statusCode === 413 || code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
        problem = {
          type: 'https://hellosmart.ai/problems/payload_too_large',
          title: 'Payload Too Large',
          status: 413,
          detail: 'Request body exceeds maximum allowed size of 1 MB',
          code: 'PAYLOAD_TOO_LARGE',
          requestId,
        };
      } else if (
        statusCode === 400 ||
        code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE' ||
        code === 'FST_ERR_CTP_EMPTY_JSON_BODY'
      ) {
        problem = {
          type: 'https://hellosmart.ai/problems/bad_request',
          title: 'Bad Request',
          status: 400,
          detail: 'Malformed JSON payload or invalid request body',
          code: 'BAD_REQUEST',
          requestId,
        };
      } else if (
        statusCode === 415 ||
        code === 'FST_ERR_CTP_UNSUPPORTED_MEDIA_TYPE'
      ) {
        problem = {
          type: 'https://hellosmart.ai/problems/unsupported_media_type',
          title: 'Unsupported Media Type',
          status: 415,
          detail: 'Unsupported Media Type',
          code: 'UNSUPPORTED_MEDIA_TYPE',
          requestId,
        };
      } else if (statusCode && statusCode >= 400 && statusCode < 600) {
        problem = {
          type: `https://hellosmart.ai/problems/http_${statusCode}`,
          title: getTitleForStatus(statusCode),
          status: statusCode,
          detail: sanitizeDetail(exception.message ?? 'Request failed'),
          code: getErrorCodeForStatus(statusCode),
          requestId,
        };
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
    } else {
      console.error('[ProblemDetailsFilter] Uncaught exception:', exception);
      problem = {
        type: 'https://hellosmart.ai/problems/internal_error',
        title: 'Internal Server Error',
        status: 500,
        detail:
          process.env.NODE_ENV === 'development' && exception instanceof Error
            ? `${exception.name}: ${exception.message}`
            : 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
        requestId,
      };
    }

    void reply
      .status(problem.status)
      .header('content-type', 'application/problem+json')
      .header('x-content-type-options', 'nosniff')
      .header('x-frame-options', 'DENY')
      .send(problem);
  }
}

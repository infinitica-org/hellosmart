import { HttpException, HttpStatus } from '@nestjs/common';

export interface ProblemDetailsOptions {
  type?: string;
  title: string;
  status: HttpStatus;
  detail: string;
  code: string;
  instance?: string;
  invalidParams?: Array<{ name: string; reason: string }>;
}

/**
 * RFC 7807 / RFC 9457 Problem Details for HTTP APIs
 */
export class ProblemDetailsException extends HttpException {
  public readonly problem: ProblemDetailsOptions;

  constructor(options: ProblemDetailsOptions) {
    super(options, options.status);
    this.problem = {
      type: options.type ?? `https://hellosmart.ai/errors/${options.code.toLowerCase().replace(/_/g, '-')}`,
      ...options,
    };
  }

  static unauthorized(detail = 'Authentication is required to access this resource.', code = 'AUTH_REQUIRED'): ProblemDetailsException {
    return new ProblemDetailsException({
      title: 'Unauthorized',
      status: HttpStatus.UNAUTHORIZED,
      detail,
      code,
    });
  }

  static forbidden(detail = 'You do not have permission to access this resource.', code = 'ROLE_FORBIDDEN'): ProblemDetailsException {
    return new ProblemDetailsException({
      title: 'Forbidden',
      status: HttpStatus.FORBIDDEN,
      detail,
      code,
    });
  }

  static serviceUnavailable(detail = 'A required authentication or session dependency is currently unavailable.', code = 'SERVICE_UNAVAILABLE'): ProblemDetailsException {
    return new ProblemDetailsException({
      title: 'Service Unavailable',
      status: HttpStatus.SERVICE_UNAVAILABLE,
      detail,
      code,
    });
  }

  static internalServerError(code = 'INTERNAL_ERROR', detail = 'An internal server error occurred while processing the request.'): ProblemDetailsException {
    return new ProblemDetailsException({
      title: 'Internal Server Error',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail,
      code,
    });
  }
}


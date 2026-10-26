import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { REQUEST_ID_HEADER } from '../observability/index.js';

interface FastifyReplyLike {
  status(statusCode: number): {
    send(payload: unknown): void;
  };
}

interface FastifyRequestLike {
  headers: Record<string, string | string[] | undefined>;
  id?: string;
}

@Catch(ThrottlerException)
export class ThrottlerProblemFilter implements ExceptionFilter {
  catch(_exception: ThrottlerException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReplyLike>();
    const request = ctx.getRequest<FastifyRequestLike>();
    const reqId = (request.headers[REQUEST_ID_HEADER] as string) || (request.id as string);

    response.status(HttpStatus.TOO_MANY_REQUESTS).send({
      type: 'https://hellosmart.ai/problems/rate-limited',
      title: 'Too Many Requests',
      status: HttpStatus.TOO_MANY_REQUESTS,
      detail: 'Too many attempts. Please try again later.',
      code: 'RATE_LIMITED',
      ...(reqId ? { requestId: reqId } : {}),
    });
  }
}

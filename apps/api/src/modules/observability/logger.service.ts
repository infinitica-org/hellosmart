import { Inject, Injectable, type LoggerService, Optional } from '@nestjs/common';
import type { Logger } from 'pino';
import { createLogger } from './logger.config.js';

export const PINO_LOGGER = Symbol('PINO_LOGGER');

@Injectable()
export class AppLoggerService implements LoggerService {
  private readonly logger: Logger;

  constructor(@Optional() @Inject(PINO_LOGGER) logger?: Logger) {
    this.logger = logger ?? createLogger();
  }

  getPino(): Logger {
    return this.logger;
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.emit('info', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    const { context, trace, extra } = this.extractParams(optionalParams, true);
    const payload: Record<string, unknown> = { ...extra };
    if (context !== undefined) {
      payload['context'] = context;
    }
    if (trace !== undefined) {
      payload['trace'] = trace;
    }

    if (typeof message === 'object' && message !== null) {
      this.logger.error({ ...payload, ...message });
    } else {
      this.logger.error(payload, String(message));
    }
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.emit('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.emit('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.emit('trace', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    const { context, trace, extra } = this.extractParams(optionalParams, true);
    const payload: Record<string, unknown> = { ...extra };
    if (context !== undefined) {
      payload['context'] = context;
    }
    if (trace !== undefined) {
      payload['trace'] = trace;
    }

    if (typeof message === 'object' && message !== null) {
      this.logger.fatal({ ...payload, ...message });
    } else {
      this.logger.fatal(payload, String(message));
    }
  }

  private emit(
    level: 'info' | 'warn' | 'debug' | 'trace',
    message: unknown,
    params: unknown[],
  ): void {
    const { context, extra } = this.extractParams(params, false);
    const payload: Record<string, unknown> = { ...extra };
    if (context !== undefined) {
      payload['context'] = context;
    }

    if (typeof message === 'object' && message !== null) {
      this.logger[level]({ ...payload, ...message });
    } else {
      this.logger[level](payload, String(message));
    }
  }

  private extractParams(
    params: unknown[],
    isError: boolean,
  ): { context?: string; trace?: string; extra?: Record<string, unknown> } {
    if (params.length === 0) {
      return {};
    }

    const result: { context?: string; trace?: string; extra?: Record<string, unknown> } = {};

    if (isError) {
      if (params[0] instanceof Error) {
        if (params[0].stack !== undefined) {
          result.trace = params[0].stack;
        } else {
          result.trace = params[0].message;
        }
        if (typeof params[1] === 'string') {
          result.context = params[1];
        }
      } else if (params.length === 1 && typeof params[0] === 'string') {
        // Lone string parameter: determine if it is a stack trace or context identifier
        if (this.isStackLike(params[0])) {
          result.trace = params[0];
        } else {
          result.context = params[0];
        }
      } else {
        // Multiple parameters: standard NestJS (trace, context) positional ordering
        if (typeof params[0] === 'string') {
          result.trace = params[0];
        }
        if (typeof params[1] === 'string') {
          result.context = params[1];
        }
      }

      let extra: Record<string, unknown> | undefined;
      for (const p of params) {
        if (typeof p === 'object' && p !== null && !(p instanceof Error) && !Array.isArray(p)) {
          extra = { ...extra, ...(p as Record<string, unknown>) };
        }
      }
      if (extra !== undefined) {
        result.extra = extra;
      }

      return result;
    }

    const last = params[params.length - 1];
    if (typeof last === 'string') {
      result.context = last;
    }

    let extra: Record<string, unknown> | undefined;
    for (const p of params) {
      if (typeof p === 'object' && p !== null && !Array.isArray(p)) {
        extra = { ...extra, ...(p as Record<string, unknown>) };
      }
    }
    if (extra !== undefined) {
      result.extra = extra;
    }

    return result;
  }

  private isStackLike(val: string): boolean {
    return val.includes('\n') || val.includes('at ') || /^([a-zA-Z0-9_]*Error|Exception):/i.test(val);
  }
}

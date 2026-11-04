import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { FastifyReply } from 'fastify';
import { Public } from '../../common/decorators/public.decorator.js';
import { HealthService } from './health.service.js';

@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /** Liveness: process is up (orchestrator restarts if this fails). */
  @Public()
  @Get()
  getHealth(): { status: 'ok' } {
    return this.health.liveness();
  }

  /** Readiness: dependencies required to serve traffic. 503 when Postgres or Redis fails. */
  @Public()
  @Get('ready')
  async getReady(@Res({ passthrough: true }) reply: FastifyReply): Promise<ReturnType<HealthService['readiness']>> {
    const body = await this.health.readiness();
    if (body.status !== 'ok') {
      reply.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return body;
  }
}

import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
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

  /** Readiness: dependencies required to serve traffic. */
  @Public()
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  async getReady(): Promise<ReturnType<HealthService['readiness']>> {
    return this.health.readiness();
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  CreatePlatformAiKeyDtoSchema,
  UpdatePlatformAiKeyDtoSchema,
  CreateCreditAllocationDtoSchema,
  AdjustCreditAllocationDtoSchema,
} from '@hs/contracts';
import { z } from 'zod';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { problem } from '../../common/errors/app-http.exception.js';
import { flattenZodErrors } from '../../common/validation/zod-errors.js';
import {
  REQUEST_USER_KEY,
  type AuthenticatedRequest,
} from '../../common/guards/session.guard.js';
import type { RequestMeta } from '../auth/auth.service.js';
import { AdminAiKeysService } from './admin-ai-keys.service.js';

const uuidParamSchema = z.string().uuid();

@Controller('admin')
@Roles('platform_admin')
export class AdminAiKeysController {
  constructor(
    @Inject(AdminAiKeysService)
    private readonly aiVault: AdminAiKeysService,
  ) {}

  private extractActor(req: any) {
    const user = req[REQUEST_USER_KEY] || req.user;
    if (!user) {
      throw problem({
        title: 'Unauthorized',
        status: 401,
        detail: 'Authentication required for administrative access.',
        code: 'UNAUTHORIZED',
      });
    }
    return user;
  }

  private extractMeta(req: any): RequestMeta {
    return {
      ip: req.ip || req.headers?.['x-forwarded-for'] || '127.0.0.1',
      userAgent: req.headers?.['user-agent'] || 'unknown',
      requestId: req.id || req.headers?.['x-request-id'] || 'req-unknown',
    };
  }

  // ==========================================
  // Platform AI Keys Vault Routes
  // ==========================================

  @Get('ai-keys')
  async listKeys() {
    return await this.aiVault.listKeys();
  }

  @Post('ai-keys')
  @HttpCode(201)
  async createKey(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
    const actor = this.extractActor(req);
    const meta = this.extractMeta(req);

    const parsed = CreatePlatformAiKeyDtoSchema.safeParse(body);
    if (!parsed.success) {
      throw problem({
        title: 'Validation Error',
        status: 422,
        detail: 'Invalid platform AI key payload',
        code: 'VALIDATION_ERROR',
        errors: flattenZodErrors(parsed.error),
      });
    }

    return await this.aiVault.createKey(parsed.data, actor, meta);
  }

  @Get('ai-keys/:id')
  async getKeyById(@Param('id') id: string) {
    if (!uuidParamSchema.safeParse(id).success) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Invalid key ID format. Must be a valid UUID.',
        code: 'INVALID_ID_FORMAT',
      });
    }
    return await this.aiVault.getKeyById(id);
  }

  @Patch('ai-keys/:id')
  async updateKey(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const actor = this.extractActor(req);
    const meta = this.extractMeta(req);

    if (!uuidParamSchema.safeParse(id).success) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Invalid key ID format. Must be a valid UUID.',
        code: 'INVALID_ID_FORMAT',
      });
    }

    const parsed = UpdatePlatformAiKeyDtoSchema.safeParse(body);
    if (!parsed.success) {
      throw problem({
        title: 'Validation Error',
        status: 422,
        detail: 'Invalid update payload',
        code: 'VALIDATION_ERROR',
        errors: flattenZodErrors(parsed.error),
      });
    }

    return await this.aiVault.updateKey(id, parsed.data, actor, meta);
  }

  @Delete('ai-keys/:id')
  async deleteKey(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const actor = this.extractActor(req);
    const meta = this.extractMeta(req);

    if (!uuidParamSchema.safeParse(id).success) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Invalid key ID format. Must be a valid UUID.',
        code: 'INVALID_ID_FORMAT',
      });
    }

    return await this.aiVault.deleteKey(id, actor, meta);
  }

  @Post('ai-keys/:id/test')
  async testKey(@Param('id') id: string) {
    if (!uuidParamSchema.safeParse(id).success) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Invalid key ID format. Must be a valid UUID.',
        code: 'INVALID_ID_FORMAT',
      });
    }
    return await this.aiVault.testKey(id);
  }

  // ==========================================
  // Tenant Credit Allocation Routes
  // ==========================================

  @Get('ai-allocations')
  async listAllocations(
    @Query('orgId') orgId?: string,
    @Query('platformKeyId') platformKeyId?: string,
    @Query('status') status?: string,
  ) {
    const filter: { orgId?: string; platformKeyId?: string; status?: string } = {};
    if (orgId) filter.orgId = orgId;
    if (platformKeyId) filter.platformKeyId = platformKeyId;
    if (status) filter.status = status;
    return await this.aiVault.listAllocations(filter);
  }

  @Post('ai-allocations')
  @HttpCode(201)
  async createAllocation(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
    const actor = this.extractActor(req);
    const meta = this.extractMeta(req);

    const parsed = CreateCreditAllocationDtoSchema.safeParse(body);
    if (!parsed.success) {
      throw problem({
        title: 'Validation Error',
        status: 422,
        detail: 'Invalid credit allocation payload',
        code: 'VALIDATION_ERROR',
        errors: flattenZodErrors(parsed.error),
      });
    }

    return await this.aiVault.createAllocation(parsed.data, actor, meta);
  }

  @Get('ai-allocations/:id')
  async getAllocationById(@Param('id') id: string) {
    if (!uuidParamSchema.safeParse(id).success) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Invalid allocation ID format. Must be a valid UUID.',
        code: 'INVALID_ID_FORMAT',
      });
    }
    return await this.aiVault.getAllocationById(id);
  }

  @Patch('ai-allocations/:id')
  async adjustAllocation(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const actor = this.extractActor(req);
    const meta = this.extractMeta(req);

    if (!uuidParamSchema.safeParse(id).success) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Invalid allocation ID format. Must be a valid UUID.',
        code: 'INVALID_ID_FORMAT',
      });
    }

    const parsed = AdjustCreditAllocationDtoSchema.safeParse(body);
    if (!parsed.success) {
      throw problem({
        title: 'Validation Error',
        status: 422,
        detail: 'Invalid credit adjustment payload',
        code: 'VALIDATION_ERROR',
        errors: flattenZodErrors(parsed.error),
      });
    }

    return await this.aiVault.adjustAllocation(id, parsed.data, actor, meta);
  }

  @Post('ai-allocations/:id/revoke')
  async revokeAllocation(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthenticatedRequest) {
    const actor = this.extractActor(req);
    const meta = this.extractMeta(req);

    if (!uuidParamSchema.safeParse(id).success) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Invalid allocation ID format. Must be a valid UUID.',
        code: 'INVALID_ID_FORMAT',
      });
    }

    const RevokePayloadSchema = z.object({
      reason: z.string().min(3).max(500).optional(),
    });

    const parsed = RevokePayloadSchema.safeParse(body || {});
    return await this.aiVault.revokeAllocation(id, actor, meta, parsed.success ? parsed.data.reason : undefined);
  }

  // ==========================================
  // Vault & Allocation Overview Stats
  // ==========================================

  @Get('ai-vault/stats')
  async getVaultStats() {
    return await this.aiVault.getVaultStats();
  }
}

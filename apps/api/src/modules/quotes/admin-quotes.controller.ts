import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import {
  CreatePricingCatalogItemDtoSchema,
  CreatePromoCodeDtoSchema,
  CreateQuoteDtoSchema,
  UpdatePricingCatalogItemDtoSchema,
} from '@hs/contracts';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { problem } from '../../common/errors/app-http.exception.js';
import { flattenZodErrors } from '../../common/validation/zod-errors.js';
import { REQUEST_USER_KEY } from '../../common/guards/session.guard.js';
import type { AuthenticatedUser } from '../../common/constants/auth.constants.js';
import { PricingCatalogService } from './pricing-catalog.service.js';
import { PromoCodesService } from './promo-codes.service.js';
import { QuotesService } from './quotes.service.js';

@Controller('admin')
@Roles('platform_admin')
export class AdminQuotesController {
  constructor(
    private readonly quotesService: QuotesService,
    private readonly catalogService: PricingCatalogService,
    private readonly promoService: PromoCodesService,
  ) {}

  // --- Quotes Management ---

  @Post('quotes')
  @HttpCode(HttpStatus.CREATED)
  async createQuote(
    @Body() body: unknown,
    @Req() req: FastifyRequest,
  ) {
    const parsed = CreateQuoteDtoSchema.safeParse(body);
    if (!parsed.success) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Invalid quote creation payload',
        code: 'VALIDATION_ERROR',
        errors: flattenZodErrors(parsed.error),
      });
    }

    const user: AuthenticatedUser | undefined = (req as any)[REQUEST_USER_KEY];

    return await this.quotesService.createQuote({
      dto: parsed.data,
      userId: user?.userId,
      userRole: user?.role,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: (req as any).id,
    });
  }

  @Get('quotes')
  async listQuotes(
    @Query('leadId') leadId?: string,
    @Query('orgId') orgId?: string,
    @Query('status') status?: string,
  ) {
    return await this.quotesService.listQuotes({ leadId, orgId, status });
  }

  @Get('quotes/:id')
  async getQuote(@Param('id') id: string) {
    const quote = await this.quotesService.getQuoteById(id);
    if (!quote) {
      throw problem({
        title: 'Not Found',
        status: 404,
        detail: `Quote '${id}' not found`,
        code: 'QUOTE_NOT_FOUND',
      });
    }
    return quote;
  }

  // --- Pricing Catalog Management ---

  @Get('pricing-catalog')
  async listCatalog(
    @Query('isActive') isActive?: string,
    @Query('category') category?: string,
    @Query('currency') currency?: string,
  ) {
    const activeFilter = isActive !== undefined ? isActive === 'true' : undefined;
    return await this.catalogService.listCatalog({
      isActive: activeFilter,
      category,
      currency: currency as any,
    });
  }

  @Get('pricing-catalog/:id')
  async getCatalogItem(@Param('id') id: string) {
    const item = await this.catalogService.getCatalogItemById(id);
    if (!item) {
      throw problem({
        title: 'Not Found',
        status: 404,
        detail: `Catalog product '${id}' not found`,
        code: 'PRODUCT_NOT_FOUND',
      });
    }
    return item;
  }

  @Post('pricing-catalog')
  @HttpCode(HttpStatus.CREATED)
  async createCatalogItem(@Body() body: unknown) {
    const parsed = CreatePricingCatalogItemDtoSchema.safeParse(body);
    if (!parsed.success) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Invalid pricing catalog payload',
        code: 'VALIDATION_ERROR',
        errors: flattenZodErrors(parsed.error),
      });
    }

    return await this.catalogService.createCatalogItem(parsed.data);
  }

  @Patch('pricing-catalog/:id')
  async updateCatalogItem(
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = UpdatePricingCatalogItemDtoSchema.safeParse(body);
    if (!parsed.success) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Invalid pricing catalog update payload',
        code: 'VALIDATION_ERROR',
        errors: flattenZodErrors(parsed.error),
      });
    }

    return await this.catalogService.updateCatalogItem(id, parsed.data);
  }

  @Post('pricing-catalog/:id/activate')
  @HttpCode(HttpStatus.OK)
  async activateCatalogItem(@Param('id') id: string) {
    return await this.catalogService.setCatalogItemStatus(id, true);
  }

  @Post('pricing-catalog/:id/deactivate')
  @HttpCode(HttpStatus.OK)
  async deactivateCatalogItem(@Param('id') id: string) {
    return await this.catalogService.setCatalogItemStatus(id, false);
  }

  // --- Promo Codes Management ---

  @Get('promo-codes')
  async listPromoCodes() {
    return await this.promoService.listPromoCodes();
  }

  @Post('promo-codes')
  @HttpCode(HttpStatus.CREATED)
  async createPromoCode(@Body() body: unknown) {
    const parsed = CreatePromoCodeDtoSchema.safeParse(body);
    if (!parsed.success) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Invalid promo code payload',
        code: 'VALIDATION_ERROR',
        errors: flattenZodErrors(parsed.error),
      });
    }

    return await this.promoService.createPromoCode(parsed.data);
  }
}

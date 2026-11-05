import { Module } from '@nestjs/common';
import { AppConfigModule } from '../../config/config.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { GstCalculatorService } from './gst-calculator.service.js';
import { PricingCatalogService } from './pricing-catalog.service.js';
import { PromoCodesService } from './promo-codes.service.js';
import { QuotesService } from './quotes.service.js';
import { AdminQuotesController } from './admin-quotes.controller.js';
import { CustomerQuotesController } from './customer-quotes.controller.js';

@Module({
  imports: [DatabaseModule, AppConfigModule],
  controllers: [AdminQuotesController, CustomerQuotesController],
  providers: [
    GstCalculatorService,
    PricingCatalogService,
    PromoCodesService,
    QuotesService,
  ],
  exports: [
    GstCalculatorService,
    PricingCatalogService,
    PromoCodesService,
    QuotesService,
  ],
})
export class QuotesModule {}

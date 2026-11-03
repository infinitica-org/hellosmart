import { Module } from '@nestjs/common';
import { CalcomWebhookController } from './calcom-webhook.controller.js';
import { CalcomWebhookService } from './calcom-webhook.service.js';

@Module({
  controllers: [CalcomWebhookController],
  providers: [CalcomWebhookService],
  exports: [CalcomWebhookService],
})
export class CalcomWebhookModule {}

import { Module } from '@nestjs/common';
import { CandidatesController } from './candidates.controller.js';
import { CandidatesService } from './candidates.service.js';
import { MailService } from '../../common/services/mail.service.js';

@Module({
  controllers: [CandidatesController],
  providers: [CandidatesService, MailService],
  exports: [CandidatesService],
})
export class CandidatesModule {}

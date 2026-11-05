import { Global, Module } from '@nestjs/common';
import {
  createEmailSender,
  createPaymentGateway,
  createSafeHttp,
  createSecretStore,
  createWorkspaceRuntime,
} from '@hs/adapters';
import { APP_CONFIG } from '../../config/config.tokens.js';
import type { Config } from '../../config/config.js';
import {
  EMAIL_SENDER_PORT,
  PAYMENT_GATEWAY_PORT,
  SAFE_HTTP_PORT,
  SECRET_STORE_PORT,
  WORKSPACE_RUNTIME_PORT,
} from './adapters.tokens.js';

@Global()
@Module({
  providers: [
    {
      provide: PAYMENT_GATEWAY_PORT,
      useFactory: (config: Config) => createPaymentGateway(config.PAYMENT_GATEWAY),
      inject: [APP_CONFIG],
    },
    {
      provide: EMAIL_SENDER_PORT,
      useFactory: (config: Config) => createEmailSender(config.EMAIL_PROVIDER),
      inject: [APP_CONFIG],
    },
    {
      provide: WORKSPACE_RUNTIME_PORT,
      useFactory: (config: Config) => createWorkspaceRuntime(config.WORKSPACE_RUNTIME),
      inject: [APP_CONFIG],
    },
    {
      provide: SECRET_STORE_PORT,
      useFactory: () => createSecretStore(),
    },
    {
      provide: SAFE_HTTP_PORT,
      useFactory: () => createSafeHttp(),
    },
  ],
  exports: [
    PAYMENT_GATEWAY_PORT,
    EMAIL_SENDER_PORT,
    WORKSPACE_RUNTIME_PORT,
    SECRET_STORE_PORT,
    SAFE_HTTP_PORT,
  ],
})
export class AdaptersModule {}

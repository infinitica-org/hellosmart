import type { EmailSender, PaymentGateway, SafeHttp, SecretStore, WorkspaceRuntime } from '@hs/adapters';

export const PAYMENT_GATEWAY_PORT = Symbol('PAYMENT_GATEWAY_PORT');
export const EMAIL_SENDER_PORT = Symbol('EMAIL_SENDER_PORT');
export const WORKSPACE_RUNTIME_PORT = Symbol('WORKSPACE_RUNTIME_PORT');
export const SECRET_STORE_PORT = Symbol('SECRET_STORE_PORT');
export const SAFE_HTTP_PORT = Symbol('SAFE_HTTP_PORT');

export type PaymentGatewayPort = PaymentGateway;
export type EmailSenderPort = EmailSender;
export type WorkspaceRuntimePort = WorkspaceRuntime;
export type SecretStorePort = SecretStore;
export type SafeHttpPort = SafeHttp;

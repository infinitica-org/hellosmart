import type { Buffer } from 'node:buffer';

// Ports for every external dependency. Each has a real and a fake implementation so no department
// is ever blocked on credentials. Selected by env (*_PROVIDER / PAYMENT_GATEWAY / WORKSPACE_RUNTIME).
// Fakes are forbidden in production (enforced in apps/api config).

export interface PaymentGateway {
  createPaymentLink(input: { quoteId: string; amountMinor: number; currency: 'INR'; customerEmail: string }): Promise<{ gatewayRef: string; url: string }>;
  createSubscription(input: { orgId: string; planCode: string }): Promise<{ gatewayRef: string; checkoutUrl: string }>;
  /** Must verify signature with constant-time comparison before parsing. Throws on mismatch. */
  verifyWebhook(rawBody: Buffer, signature: string): PaymentEvent;
}
export type PaymentEvent =
  | { type: 'payment.succeeded'; gatewayRef: string; amountMinor: number }
  | { type: 'payment.failed'; gatewayRef: string; reason: string }
  | { type: 'subscription.charged' | 'subscription.halted'; gatewayRef: string };

export interface EmailSender {
  send(input: { to: string; template: string; vars: Record<string, string>; orgId?: string }): Promise<{ providerId: string }>;
}

export interface WorkspaceRuntime {
  createSlot(input: { orgId: string; workspaceId: string; image: string; size: 'small' | 'medium' | 'dedicated'; egressAllow: string[]; aiEnabled: boolean }): Promise<{ slotId: string; hostId: string }>;
  snapshot(slotId: string): Promise<{ snapshotKey: string }>;
  destroy(slotId: string): Promise<void>;
}

export interface SecretStore {
  /** Returns plaintext only into process memory. Never log the result. */
  get(ref: string): Promise<string>;
  put(input: { orgId: string; name: string; value: string }): Promise<{ ref: string; last4: string }>;
  delete(ref: string): Promise<void>;
}

/** Outbound HTTP for user-influenced URLs (webhooks tests, logo fetch, DNS checks). SSRF-safe. */
export interface SafeHttp {
  get(url: string, opts?: { allowHosts?: string[]; timeoutMs?: number; maxBytes?: number }): Promise<{ status: number; body: Buffer }>;
}

// Export Fake implementations
export * from './fake-payment.js';
export * from './fake-email.js';
export * from './fake-workspace.js';
export * from './fake-secrets.js';
export * from './fake-http.js';
export * from './fake-llm.js';

import { FakeEmailSender } from './fake-email.js';
import { FakePaymentGateway } from './fake-payment.js';
import { FakeSafeHttp } from './fake-http.js';
import { FakeSecretStore } from './fake-secrets.js';
import { FakeWorkspaceRuntime } from './fake-workspace.js';

export type PaymentProvider = 'fake' | 'razorpay';
export type EmailProvider = 'fake' | 'ses';
export type WorkspaceRuntimeProvider = 'fake' | 'sysbox';

export function createPaymentGateway(provider: PaymentProvider): PaymentGateway {
  if (provider === 'fake') {
    return new FakePaymentGateway();
  }
  throw new Error('Razorpay payment gateway is not implemented in MMP yet');
}

export function createEmailSender(provider: EmailProvider): EmailSender {
  if (provider === 'fake') {
    return new FakeEmailSender();
  }
  throw new Error('SES email provider is not implemented in MMP yet');
}

export function createWorkspaceRuntime(provider: WorkspaceRuntimeProvider): WorkspaceRuntime {
  if (provider === 'fake') {
    return new FakeWorkspaceRuntime();
  }
  throw new Error('Sysbox workspace runtime is not wired in apps/api yet');
}

export function createSecretStore(): SecretStore {
  return new FakeSecretStore();
}

export function createSafeHttp(): SafeHttp {
  return new FakeSafeHttp();
}

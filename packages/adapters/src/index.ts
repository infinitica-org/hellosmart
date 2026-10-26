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

export * from './secret-store/aws-secrets-manager.store.js';
export * from './secret-store/memory-secret.store.js';


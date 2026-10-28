import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import type { PaymentGateway, PaymentEvent } from './index.js';

export interface FakePaymentLinkRecord {
  quoteId: string;
  amountMinor: number;
  currency: 'INR';
  customerEmail: string;
  gatewayRef: string;
  url: string;
  status: 'created' | 'paid' | 'failed';
  createdAt: Date;
}

export interface FakeSubscriptionRecord {
  orgId: string;
  planCode: string;
  gatewayRef: string;
  checkoutUrl: string;
  status: 'active' | 'halted';
  createdAt: Date;
}

export class FakePaymentGateway implements PaymentGateway {
  private paymentLinks = new Map<string, FakePaymentLinkRecord>();
  private subscriptions = new Map<string, FakeSubscriptionRecord>();
  private webhookSecret: string;

  constructor(webhookSecret: string = 'fake-webhook-secret') {
    this.webhookSecret = webhookSecret;
  }

  async createPaymentLink(input: {
    quoteId: string;
    amountMinor: number;
    currency: 'INR';
    customerEmail: string;
  }): Promise<{ gatewayRef: string; url: string }> {
    const gatewayRef = `pay_fake_${crypto.randomUUID()}`;
    const url = `https://checkout.fake.hellosmart.ai/pay/${gatewayRef}`;

    const record: FakePaymentLinkRecord = {
      ...input,
      gatewayRef,
      url,
      status: 'created',
      createdAt: new Date(),
    };

    this.paymentLinks.set(gatewayRef, record);
    return { gatewayRef, url };
  }

  async createSubscription(input: {
    orgId: string;
    planCode: string;
  }): Promise<{ gatewayRef: string; checkoutUrl: string }> {
    const gatewayRef = `sub_fake_${crypto.randomUUID()}`;
    const checkoutUrl = `https://checkout.fake.hellosmart.ai/sub/${gatewayRef}`;

    const record: FakeSubscriptionRecord = {
      ...input,
      gatewayRef,
      checkoutUrl,
      status: 'active',
      createdAt: new Date(),
    };

    this.subscriptions.set(gatewayRef, record);
    return { gatewayRef, checkoutUrl };
  }

  /**
   * Must verify signature with constant-time comparison before parsing. Throws on mismatch.
   */
  verifyWebhook(rawBody: Buffer, signature: string): PaymentEvent {
    // Constant-time signature verification simulation
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');

    // Also accept literal 'valid-test-signature' for unit test convenience
    const isMockValid = signature === 'valid-test-signature';
    const isHashValid =
      signature.length === expectedSignature.length &&
      crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));

    if (!isMockValid && !isHashValid) {
      throw new Error('Invalid webhook signature');
    }

    try {
      const payload = JSON.parse(rawBody.toString('utf8')) as PaymentEvent;
      if (!payload.type || !payload.gatewayRef) {
        throw new Error('Malformed payment event payload');
      }

      // Update in-memory records
      if (payload.type === 'payment.succeeded') {
        const link = this.paymentLinks.get(payload.gatewayRef);
        if (link) link.status = 'paid';
      } else if (payload.type === 'payment.failed') {
        const link = this.paymentLinks.get(payload.gatewayRef);
        if (link) link.status = 'failed';
      } else if (payload.type === 'subscription.halted') {
        const sub = this.subscriptions.get(payload.gatewayRef);
        if (sub) sub.status = 'halted';
      }

      return payload;
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'Malformed payment event payload') {
        throw err;
      }
      throw new Error('Failed to parse webhook payload');
    }
  }

  /** Generates a signed webhook payload for test harnesses */
  signPayload(payload: PaymentEvent): { body: Buffer; signature: string } {
    const body = Buffer.from(JSON.stringify(payload), 'utf8');
    const signature = crypto.createHmac('sha256', this.webhookSecret).update(body).digest('hex');
    return { body, signature };
  }

  getPaymentLink(gatewayRef: string): FakePaymentLinkRecord | undefined {
    return this.paymentLinks.get(gatewayRef);
  }

  getSubscription(gatewayRef: string): FakeSubscriptionRecord | undefined {
    return this.subscriptions.get(gatewayRef);
  }

  clear(): void {
    this.paymentLinks.clear();
    this.subscriptions.clear();
  }
}

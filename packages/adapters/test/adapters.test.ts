import { describe, it, expect, beforeEach } from 'vitest';
import {
  FakePaymentGateway,
  FakeEmailSender,
  FakeWorkspaceRuntime,
  FakeSecretStore,
  FakeSafeHttp,
  FakeLLMClient,
} from '../src/index.js';

describe('@hs/adapters: Fake Adapters', () => {
  describe('FakePaymentGateway', () => {
    let gateway: FakePaymentGateway;

    beforeEach(() => {
      gateway = new FakePaymentGateway('test-secret');
    });

    it('creates payment link and records in memory', async () => {
      const link = await gateway.createPaymentLink({
        quoteId: 'q-123',
        amountMinor: 50000,
        currency: 'INR',
        customerEmail: 'customer@example.com',
      });

      expect(link.gatewayRef).toMatch(/^pay_fake_/);
      expect(link.url).toContain(link.gatewayRef);

      const record = gateway.getPaymentLink(link.gatewayRef);
      expect(record).toBeDefined();
      expect(record?.status).toBe('created');
    });

    it('verifies signed webhook and updates status', () => {
      const payload = {
        type: 'payment.succeeded' as const,
        gatewayRef: 'pay_fake_test_1',
        amountMinor: 50000,
      };

      const { body, signature } = gateway.signPayload(payload);
      const verified = gateway.verifyWebhook(body, signature);

      expect(verified).toEqual(payload);
    });

    it('rejects invalid signature with an error', () => {
      const body = Buffer.from(JSON.stringify({ type: 'payment.succeeded', gatewayRef: 'test' }));
      expect(() => gateway.verifyWebhook(body, 'bad-signature')).toThrow('Invalid webhook signature');
    });
  });

  describe('FakeEmailSender', () => {
    let emailSender: FakeEmailSender;

    beforeEach(() => {
      emailSender = new FakeEmailSender();
    });

    it('sends email and captures into in-memory queue', async () => {
      const res = await emailSender.send({
        to: 'candidate@example.com',
        template: 'candidate-invite',
        vars: { inviteUrl: 'https://hellosmart.ai/invite/123' },
      });

      expect(res.providerId).toMatch(/^email_fake_/);
      expect(emailSender.getSentEmails()).toHaveLength(1);
      expect(emailSender.getLastEmail()?.to).toBe('candidate@example.com');
    });
  });

  describe('FakeWorkspaceRuntime', () => {
    let runtime: FakeWorkspaceRuntime;

    beforeEach(() => {
      runtime = new FakeWorkspaceRuntime('host_01');
    });

    it('creates slot, takes snapshot, and destroys slot', async () => {
      const slot = await runtime.createSlot({
        orgId: 'org_1',
        workspaceId: 'ws_1',
        image: 'ubuntu:24.04',
        size: 'medium',
        egressAllow: ['registry.npmjs.org'],
        aiEnabled: true,
      });

      expect(slot.slotId).toMatch(/^slot_fake_/);
      expect(slot.hostId).toBe('host_01');

      const snap = await runtime.snapshot(slot.slotId);
      expect(snap.snapshotKey).toContain('snapshots/org_1/ws_1');

      await runtime.destroy(slot.slotId);
      const record = runtime.getSlot(slot.slotId);
      expect(record?.status).toBe('destroyed');
    });
  });

  describe('FakeSecretStore', () => {
    let store: FakeSecretStore;

    beforeEach(() => {
      store = new FakeSecretStore();
    });

    it('stores secret, masks last4, and retrieves plaintext in memory', async () => {
      const { ref, last4 } = await store.put({
        orgId: 'org_1',
        name: 'OPENAI_API_KEY',
        value: 'sk-proj-1234567890abcdef',
      });

      expect(ref).toMatch(/^sec_fake_/);
      expect(last4).toBe('cdef');

      const plain = await store.get(ref);
      expect(plain).toBe('sk-proj-1234567890abcdef');

      await store.delete(ref);
      await expect(store.get(ref)).rejects.toThrow('Secret not found');
    });
  });

  describe('FakeSafeHttp', () => {
    let safeHttp: FakeSafeHttp;

    beforeEach(() => {
      safeHttp = new FakeSafeHttp();
    });

    it('blocks internal SSRF targets', async () => {
      await expect(safeHttp.get('http://169.254.169.254/latest/meta-data')).rejects.toThrow('SSRF blocked');
      await expect(safeHttp.get('http://127.0.0.1:8080')).rejects.toThrow('SSRF blocked');
      await expect(safeHttp.get('http://192.168.1.1')).rejects.toThrow('SSRF blocked');
    });

    it('allows public hosts and custom mocks', async () => {
      safeHttp.mockResponse('https://api.github.com/zen', { status: 200, body: 'Keep it logically awesome.' });
      const res = await safeHttp.get('https://api.github.com/zen');
      expect(res.status).toBe(200);
      expect(res.body.toString('utf8')).toBe('Keep it logically awesome.');
    });
  });

  describe('FakeLLMClient', () => {
    it('returns canned and default responses', async () => {
      const llm = new FakeLLMClient();
      llm.setResponse('hello', 'Hello! How can I help?');

      const res1 = await llm.complete('Say hello please');
      expect(res1.text).toBe('Hello! How can I help?');

      const res2 = await llm.complete('unmatched prompt');
      expect(res2.text).toContain('Simulated LLM response for testing');
    });
  });
});

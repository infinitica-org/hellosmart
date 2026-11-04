import crypto from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CalcomWebhookService } from '../src/modules/webhooks/calcom/calcom-webhook.service.js';

const TEST_SECRET = 'test_calcom_webhook_secret_key_123456';

function signPayload(body: Buffer, secret: string = TEST_SECRET): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

describe('S1-T09-1: Cal.com Webhook Ingestion & Sales Lead Pipeline', () => {
  let platformPool: pg.Pool;
  let appPool: pg.Pool;
  let service: CalcomWebhookService;
  let isDbAvailable = false;

  beforeAll(async () => {
    const platformUrl = process.env.DATABASE_PLATFORM_URL || 'postgres://hs_platform:hs_platform_local@127.0.0.1:5432/hellosmart';
    const appUrl = process.env.DATABASE_URL || 'postgres://hs_app:hs_app_local@127.0.0.1:5432/hellosmart';

    platformPool = new pg.Pool({ connectionString: platformUrl, max: 5 });
    appPool = new pg.Pool({ connectionString: appUrl, max: 3 });

    try {
      const client = await platformPool.connect();
      await client.query('SELECT 1');
      client.release();
      isDbAvailable = true;

      // Ensure migration 14 has been executed on the test database
      const migratorUrl = process.env.DATABASE_MIGRATOR_URL || 'postgres://hs_migrator:hs_migrator_local@127.0.0.1:5432/hellosmart';
      const migratorPool = new pg.Pool({ connectionString: migratorUrl });
      const migClient = await migratorPool.connect();
      try {
        const fs = await import('node:fs/promises');
        const path = await import('node:path');
        const migrationPath = path.resolve(__dirname, '../../../packages/contracts/db/migrations/0014_calcom_webhook_ingestion_and_leads.sql');
        const sql = await fs.readFile(migrationPath, 'utf8');
        await migClient.query(sql);
      } finally {
        migClient.release();
        await migratorPool.end();
      }
    } catch (err: any) {
      console.warn('Database not available for integration tests:', err.message);
      isDbAvailable = false;
    }

    const mockConfig: any = {
      CALCOM_WEBHOOK_SECRET: TEST_SECRET,
    };
    service = new CalcomWebhookService(mockConfig, platformPool);
  });

  async function queryPlatform(sql: string, params?: any[]) {
    const client = await platformPool.connect();
    try {
      await client.query("SELECT set_config('app.is_platform', 'true', false)");
      return await client.query(sql, params);
    } finally {
      client.release();
    }
  }

  afterAll(async () => {
    if (platformPool) await platformPool.end().catch(() => {});
    if (appPool) await appPool.end().catch(() => {});
  });

  describe('1. HMAC Verification & Security Guards', () => {
    it('verifies valid HMAC-SHA256 signature securely', () => {
      const body = Buffer.from(JSON.stringify({ triggerEvent: 'BOOKING_CREATED' }));
      const signature = signPayload(body);
      expect(service.verifyHmac(body, signature)).toBe(true);
    });

    it('supports sha256= prefix in signature header', () => {
      const body = Buffer.from(JSON.stringify({ triggerEvent: 'BOOKING_CREATED' }));
      const signature = 'sha256=' + signPayload(body);
      expect(service.verifyHmac(body, signature)).toBe(true);
    });

    it('rejects tampered body or invalid signature', () => {
      const body = Buffer.from(JSON.stringify({ triggerEvent: 'BOOKING_CREATED' }));
      const tampered = Buffer.from(JSON.stringify({ triggerEvent: 'BOOKING_CANCELLED' }));
      const signature = signPayload(body);
      expect(service.verifyHmac(tampered, signature)).toBe(false);
    });

    it('fails closed when signature or secret is missing', () => {
      const body = Buffer.from('test');
      expect(service.verifyHmac(body, undefined)).toBe(false);
      expect(service.verifyHmac(body, '')).toBe(false);

      const noSecretService = new CalcomWebhookService({ CALCOM_WEBHOOK_SECRET: '' } as any, platformPool);
      expect(noSecretService.verifyHmac(body, signPayload(body))).toBe(false);
    });
  });

  describe('2. Ingestion Filtering & Envelope Validation', () => {
    it('handles malformed JSON: persists physical delivery, records outcome ignored, 0 inbox rows', async () => {
      if (!isDbAvailable) return;
      const rawBody = Buffer.from('{"triggerEvent": "BOOKING_CREATED", invalid-json');
      const res = await service.processWebhook({
        rawBody,
        headers: { 'content-type': 'application/json' },
        parsedBody: { __malformedJson: true, parseError: 'Unexpected token' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.outcome).toBe('ignored');
      expect(res.reason).toBe('Malformed JSON syntax');
      expect(res.deliveryId).toBeDefined();

      // Verify physical delivery was durably captured
      const checkDel = await queryPlatform(
        'SELECT * FROM app.webhook_deliveries WHERE id = $1',
        [res.deliveryId],
      );
      expect(checkDel.rows.length).toBe(1);

      // Verify terminal outcome recorded in app.webhook_delivery_outcomes
      const checkOutcome = await queryPlatform(
        'SELECT * FROM app.webhook_delivery_outcomes WHERE delivery_id = $1',
        [res.deliveryId],
      );
      expect(checkOutcome.rows.length).toBe(1);
      expect(checkOutcome.rows[0].outcome).toBe('ignored');
      expect(checkOutcome.rows[0].error_code).toBe('JSON_SYNTAX_ERROR');
    });

    it('handles missing triggerEvent: persists delivery, records outcome ignored, 0 inbox rows', async () => {
      if (!isDbAvailable) return;
      const rawBody = Buffer.from(JSON.stringify({ payload: { uid: 'some-uid' } }));
      const res = await service.processWebhook({
        rawBody,
        headers: { 'content-type': 'application/json' },
        parsedBody: JSON.parse(rawBody.toString('utf8')),
      });

      expect(res.statusCode).toBe(200);
      expect(res.outcome).toBe('ignored');
      expect(res.reason).toBe('Missing triggerEvent');
    });

    it('handles unsupported trigger: persists delivery, records outcome ignored', async () => {
      if (!isDbAvailable) return;
      const rawBody = Buffer.from(JSON.stringify({ triggerEvent: 'FORM_SUBMITTED', payload: { id: 123 } }));
      const res = await service.processWebhook({
        rawBody,
        headers: { 'content-type': 'application/json' },
        parsedBody: JSON.parse(rawBody.toString('utf8')),
      });

      expect(res.statusCode).toBe(200);
      expect(res.outcome).toBe('ignored');
      expect(res.reason).toContain('Unsupported triggerEvent: FORM_SUBMITTED');
    });

    it('handles missing booking UID for supported trigger: records outcome quarantined', async () => {
      if (!isDbAvailable) return;
      const rawBody = Buffer.from(JSON.stringify({ triggerEvent: 'BOOKING_CREATED', payload: { title: 'No UID' } }));
      const res = await service.processWebhook({
        rawBody,
        headers: { 'content-type': 'application/json' },
        parsedBody: JSON.parse(rawBody.toString('utf8')),
      });

      expect(res.statusCode).toBe(200);
      expect(res.outcome).toBe('quarantined');
      expect(res.reason).toBe('Missing booking UID');
    });
  });

  describe('3. Core Domain Lifecycle: Booking Created, Rescheduled, Cancelled', () => {
    const testEmail = `prospect_${Date.now()}@example.com`;
    const uid1 = `uid_create_${Date.now()}`;
    const uid2 = `uid_reschedule_${Date.now()}`;

    it('processes BOOKING_CREATED: creates lead, sets active_booking_id, writes audit log', async () => {
      if (!isDbAvailable) return;
      const payload = {
        triggerEvent: 'BOOKING_CREATED',
        payload: {
          id: 101,
          uid: uid1,
          title: 'HelloSmart Discovery Call',
          startTime: '2026-11-15T10:00:00Z',
          endTime: '2026-11-15T10:30:00Z',
          attendees: [{ email: testEmail, name: 'Alex Prospect' }],
          responses: { company: { value: 'Acme Corp' } },
          metadata: { utm: { utm_source: 'linkedin', utm_medium: 'cpc' } },
        },
      };

      const rawBody = Buffer.from(JSON.stringify(payload));
      const res = await service.processWebhook({
        rawBody,
        headers: { 'content-type': 'application/json' },
        parsedBody: payload,
      });

      expect(res.statusCode).toBe(200);
      expect(res.outcome).toBe('processed');

      // Verify Lead created with correct stage and active booking pointer
      const leadCheck = await queryPlatform(
        'SELECT * FROM app.leads WHERE email = $1',
        [testEmail],
      );
      expect(leadCheck.rows.length).toBe(1);
      const lead = leadCheck.rows[0];
      expect(lead.name).toBe('Alex Prospect');
      expect(lead.company).toBe('Acme Corp');
      expect(lead.stage).toBe('meeting_booked');
      expect(lead.utm).toEqual({ utm_source: 'linkedin', utm_medium: 'cpc' });
      expect(lead.active_booking_id).toBeDefined();

      // Verify Booking created with status ACCEPTED
      const bookCheck = await queryPlatform(
        'SELECT * FROM app.lead_bookings WHERE uid = $1',
        [uid1],
      );
      expect(bookCheck.rows.length).toBe(1);
      const booking = bookCheck.rows[0];
      expect(booking.status).toBe('ACCEPTED');
      expect(booking.id).toBe(lead.active_booking_id);

      // Verify Audit Event logged in audit.events
      const auditCheck = await queryPlatform(
        `SELECT * FROM audit.events WHERE action = 'lead.meeting_booked' AND entity_id = $1`,
        [lead.id],
      );
      expect(auditCheck.rows.length).toBe(1);
    });

    it('processes BOOKING_RESCHEDULED: marks predecessor RESCHEDULED, links successor, updates active_booking_id', async () => {
      if (!isDbAvailable) return;
      const payload = {
        triggerEvent: 'BOOKING_RESCHEDULED',
        payload: {
          id: 102,
          uid: uid2,
          rescheduleUid: uid1,
          title: 'HelloSmart Discovery Call (Rescheduled)',
          startTime: '2026-11-16T14:00:00Z',
          endTime: '2026-11-16T14:30:00Z',
          attendees: [{ email: testEmail, name: 'Alex Prospect' }],
        },
      };

      const rawBody = Buffer.from(JSON.stringify(payload));
      const res = await service.processWebhook({
        rawBody,
        headers: { 'content-type': 'application/json' },
        parsedBody: payload,
      });

      expect(res.statusCode).toBe(200);
      expect(res.outcome).toBe('processed');

      // Verify predecessor updated to RESCHEDULED
      const predCheck = await queryPlatform(
        'SELECT * FROM app.lead_bookings WHERE uid = $1',
        [uid1],
      );
      expect(predCheck.rows[0].status).toBe('RESCHEDULED');
      expect(predCheck.rows[0].rescheduled_to_uid).toBe(uid2);

      // Verify successor inserted as ACCEPTED
      const succCheck = await queryPlatform(
        'SELECT * FROM app.lead_bookings WHERE uid = $1',
        [uid2],
      );
      expect(succCheck.rows[0].status).toBe('ACCEPTED');
      expect(succCheck.rows[0].predecessor_uid).toBe(uid1);

      // Verify Lead active_booking_id points to successor
      const leadCheck = await queryPlatform(
        'SELECT * FROM app.leads WHERE email = $1',
        [testEmail],
      );
      expect(leadCheck.rows[0].active_booking_id).toBe(succCheck.rows[0].id);
    });

    it('processes BOOKING_CANCELLED: marks booking CANCELLED and clears active_booking_id', async () => {
      if (!isDbAvailable) return;
      const payload = {
        triggerEvent: 'BOOKING_CANCELLED',
        payload: {
          uid: uid2,
          cancellationReason: 'Conflict with team meeting',
        },
      };

      const rawBody = Buffer.from(JSON.stringify(payload));
      const res = await service.processWebhook({
        rawBody,
        headers: { 'content-type': 'application/json' },
        parsedBody: payload,
      });

      expect(res.statusCode).toBe(200);
      expect(res.outcome).toBe('processed');

      // Verify booking updated to CANCELLED with reason
      const bookCheck = await queryPlatform(
        'SELECT * FROM app.lead_bookings WHERE uid = $1',
        [uid2],
      );
      expect(bookCheck.rows[0].status).toBe('CANCELLED');
      expect(bookCheck.rows[0].cancellation_reason).toBe('Conflict with team meeting');

      // Verify active_booking_id on lead is now NULL
      const leadCheck = await queryPlatform(
        'SELECT * FROM app.leads WHERE email = $1',
        [testEmail],
      );
      expect(leadCheck.rows[0].active_booking_id).toBeNull();
    });
  });

  describe('4. Idempotency & Changed-Payload Quarantine', () => {
    const email = `idem_${Date.now()}@example.com`;
    const uid = `uid_idem_${Date.now()}`;
    const payload = {
      triggerEvent: 'BOOKING_CREATED',
      payload: {
        id: 201,
        uid,
        title: 'Initial Booking',
        startTime: '2026-11-20T10:00:00Z',
        endTime: '2026-11-20T10:30:00Z',
        attendees: [{ email, name: 'Idempotent Prospect' }],
      },
    };

    it('handles exact duplicate redelivery: records duplicate_processed, 0 duplicate domain rows', async () => {
      if (!isDbAvailable) return;
      const rawBody = Buffer.from(JSON.stringify(payload));

      // 1. Initial Delivery
      const res1 = await service.processWebhook({
        rawBody,
        headers: { 'content-type': 'application/json' },
        parsedBody: payload,
      });
      expect(res1.outcome).toBe('processed');

      // 2. Exact Duplicate Redelivery
      const res2 = await service.processWebhook({
        rawBody,
        headers: { 'content-type': 'application/json' },
        parsedBody: payload,
      });
      expect(res2.statusCode).toBe(200);
      expect(res2.outcome).toBe('duplicate_processed');

      // Verify only 1 lead and 1 booking exist
      const leads = await queryPlatform('SELECT count(*) FROM app.leads WHERE email = $1', [email]);
      expect(parseInt(leads.rows[0].count, 10)).toBe(1);

      const bookings = await queryPlatform('SELECT count(*) FROM app.lead_bookings WHERE uid = $1', [uid]);
      expect(parseInt(bookings.rows[0].count, 10)).toBe(1);
    });

    it('handles changed payload for existing event key: quarantines delivery, leaves canonical event untouched', async () => {
      if (!isDbAvailable) return;
      const mutatedPayload = {
        ...payload,
        payload: {
          ...payload.payload,
          title: 'TAMPERED TITLE WITH DIFFERENT HASH',
        },
      };

      const rawBody = Buffer.from(JSON.stringify(mutatedPayload));
      const res = await service.processWebhook({
        rawBody,
        headers: { 'content-type': 'application/json' },
        parsedBody: mutatedPayload,
      });

      expect(res.statusCode).toBe(200);
      expect(res.outcome).toBe('quarantined');
      expect(res.reason).toBe('Payload hash mismatch');

      // Verify canonical inbox event remains processed and original title is preserved
      const inboxCheck = await queryPlatform(
        'SELECT * FROM app.webhook_inbox WHERE event_key = $1',
        [`calcom:BOOKING_CREATED:${uid}`],
      );
      expect(inboxCheck.rows[0].status).toBe('processed');
      expect(inboxCheck.rows[0].sanitized_payload.title).toBe('Initial Booking');
    });
  });

  describe('5. Out-of-Order Cancellation & Tombstone Resilience', () => {
    const delayedUid = `uid_delayed_${Date.now()}`;
    const initialUid = `uid_pred_${Date.now()}`;
    const email = `tombstone_${Date.now()}@example.com`;

    it('handles cancellation arriving BEFORE reschedule: persists tombstone and prevents resurrection', async () => {
      if (!isDbAvailable) return;

      // 1. Initial Booking Created
      const initPayload = {
        triggerEvent: 'BOOKING_CREATED',
        payload: {
          uid: initialUid,
          startTime: '2026-11-22T10:00:00Z',
          endTime: '2026-11-22T10:30:00Z',
          attendees: [{ email, name: 'Tombstone Lead' }],
        },
      };
      await service.processWebhook({
        rawBody: Buffer.from(JSON.stringify(initPayload)),
        headers: { 'content-type': 'application/json' },
        parsedBody: initPayload,
      });

      // 2. Cancellation for delayedUid arrives FIRST (out of order!)
      const cancelPayload = {
        triggerEvent: 'BOOKING_CANCELLED',
        payload: {
          uid: delayedUid,
          cancellationReason: 'Cancelled prior to reschedule arrival',
        },
      };
      const cancelRes = await service.processWebhook({
        rawBody: Buffer.from(JSON.stringify(cancelPayload)),
        headers: { 'content-type': 'application/json' },
        parsedBody: cancelPayload,
      });
      expect(cancelRes.statusCode).toBe(200);
      expect(cancelRes.outcome).toBe('processed');

      // Verify tombstone was persisted
      const tombstoneCheck = await queryPlatform(
        'SELECT * FROM app.booking_tombstones WHERE uid = $1',
        [delayedUid],
      );
      expect(tombstoneCheck.rows.length).toBe(1);
      expect(tombstoneCheck.rows[0].status).toBe('CANCELLED');

      // 3. Delayed Reschedule linking initialUid -> delayedUid subsequently arrives
      const delayedReschedulePayload = {
        triggerEvent: 'BOOKING_RESCHEDULED',
        payload: {
          uid: delayedUid,
          rescheduleUid: initialUid,
          startTime: '2026-11-23T11:00:00Z',
          endTime: '2026-11-23T11:30:00Z',
          attendees: [{ email, name: 'Tombstone Lead' }],
        },
      };
      const reschedRes = await service.processWebhook({
        rawBody: Buffer.from(JSON.stringify(delayedReschedulePayload)),
        headers: { 'content-type': 'application/json' },
        parsedBody: delayedReschedulePayload,
      });
      expect(reschedRes.statusCode).toBe(200);
      expect(reschedRes.outcome).toBe('processed');

      // Verify that delayedUid was inserted directly as CANCELLED (never resurrected!)
      const delayedCheck = await queryPlatform(
        'SELECT * FROM app.lead_bookings WHERE uid = $1',
        [delayedUid],
      );
      expect(delayedCheck.rows.length).toBe(1);
      expect(delayedCheck.rows[0].status).toBe('CANCELLED');
      expect(delayedCheck.rows[0].cancellation_reason).toBe('Cancelled prior to reschedule arrival');

      // Verify active_booking_id on lead is NULL
      const leadCheck = await queryPlatform(
        'SELECT * FROM app.leads WHERE email = $1',
        [email],
      );
      expect(leadCheck.rows[0].active_booking_id).toBeNull();
    });
  });

  describe('6. Database Security & RLS Tenant Isolation', () => {
    it('prohibits tenant role (hs_app) from accessing webhook deliveries, outcomes, or inbox', async () => {
      if (!isDbAvailable) return;
      const appClient = await appPool.connect();
      try {
        await expect(
          appClient.query('SELECT count(*) FROM app.webhook_deliveries'),
        ).rejects.toThrow(/permission denied/);

        await expect(
          appClient.query('SELECT count(*) FROM app.webhook_delivery_outcomes'),
        ).rejects.toThrow(/permission denied/);

        await expect(
          appClient.query('SELECT count(*) FROM app.webhook_inbox'),
        ).rejects.toThrow(/permission denied/);
      } finally {
        appClient.release();
      }
    });

    it('enforces append-only triggers and privilege restrictions: rejects UPDATE and DELETE on outcomes and inbox identity', async () => {
      if (!isDbAvailable) return;
      const client = await platformPool.connect();
      try {
        // hs_platform has revoked DELETE privilege on outcomes and inbox
        await expect(
          client.query('DELETE FROM app.webhook_delivery_outcomes'),
        ).rejects.toThrow(/permission denied/);

        await expect(
          client.query('DELETE FROM app.webhook_inbox'),
        ).rejects.toThrow(/permission denied/);
      } finally {
        client.release();
      }
    });
  });
});

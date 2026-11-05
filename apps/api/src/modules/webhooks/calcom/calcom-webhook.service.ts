import crypto from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { APP_CONFIG } from '../../../config/config.tokens.js';
import type { Config } from '../../../config/config.js';
import { PG_PLATFORM_POOL } from '../../database/database.tokens.js';
import { appendAuditEvent } from '../../audit/audit-writer.js';

export interface WebhookProcessResult {
  statusCode: number;
  outcome: string;
  reason?: string;
  deliveryId?: string;
}

const ALLOWED_HEADERS = new Set([
  'content-type',
  'user-agent',
  'host',
  'x-forwarded-for',
  'x-forwarded-proto',
  'x-forwarded-host',
  'cal-signature-256',
  'x-cal-signature-256',
]);

function filterSafeHeaders(rawHeaders: Record<string, any>): Record<string, any> {
  const safe: Record<string, any> = {};
  for (const [k, v] of Object.entries(rawHeaders)) {
    const lower = k.toLowerCase();
    if (ALLOWED_HEADERS.has(lower)) {
      safe[lower] = v;
    }
  }
  return safe;
}

function canonicalStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalStringify).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalStringify(obj[k])).join(',') + '}';
}

@Injectable()
export class CalcomWebhookService {
  private readonly logger = new Logger(CalcomWebhookService.name);

  constructor(
    @Inject(APP_CONFIG) private readonly config: Config,
    @Inject(PG_PLATFORM_POOL) private readonly platformPool: Pool,
  ) {}

  /**
   * Verifies Cal.com HMAC-SHA256 signature using constant-time comparison.
   * Fails closed if secret is unconfigured or signature is missing.
   */
  verifyHmac(rawBody: Buffer | undefined, signatureHeader: string | undefined): boolean {
    const secret = this.config.CALCOM_WEBHOOK_SECRET;
    if (!secret || secret.trim().length === 0) {
      this.logger.error('Cal.com webhook secret is not configured; failing closed (BR-13)');
      return false;
    }
    if (!rawBody || rawBody.length === 0 || !signatureHeader) {
      return false;
    }

    // Cal.com sends hex digest, sometimes prefixed with "sha256="
    const cleanSignature = signatureHeader.replace(/^sha256=/i, '').trim().toLowerCase();
    const expectedHex = crypto.createHmac('sha256', secret).update(rawBody).digest('hex').toLowerCase();

    const sigBuf = Buffer.from(cleanSignature, 'utf8');
    const expectedBuf = Buffer.from(expectedHex, 'utf8');

    if (sigBuf.length !== expectedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(sigBuf, expectedBuf);
  }

  /**
   * Orchestrates the 2-transaction intake pipeline:
   * Tx 1: Persists physical delivery wire attempt and registers canonical inbox event.
   * Tx 2: Acquires lineage-ordered advisory locks, performs domain mutations, and logs append-only audit trail.
   */
  async processWebhook(params: {
    rawBody: Buffer;
    headers: Record<string, any>;
    parsedBody: any;
    ip?: string | undefined;
    userAgent?: string | undefined;
    requestId?: string | undefined;
  }): Promise<WebhookProcessResult> {
    const safeHeaders = filterSafeHeaders(params.headers);

    // --- TRANSACTION 1: Wire Persistence & Inbox Registration ---
    const client1: PoolClient = await this.platformPool.connect();
    let deliveryId: string;
    let deliveredAt: string;
    let eventKey: string | null = null;
    let payloadHash: string | null = null;
    let triggerEvent: string | null = null;
    let bookingUid: string | null = null;
    let predecessorUid: string | null = null;
    let sanitizedPayload: any = null;
    let isMalformedJson = false;

    try {
      await client1.query('BEGIN');
      await client1.query("SELECT set_config('app.is_platform', 'true', true)");

      const isMalformed = Boolean(params.parsedBody && params.parsedBody.__malformedJson);
      isMalformedJson = isMalformed;

      if (isMalformed) {
        // Path A: Malformed JSON syntax
        const insRes = await client1.query(
          `INSERT INTO app.webhook_deliveries (gateway, raw_payload_bytes, headers)
           VALUES ('calcom', $1, $2::jsonb)
           RETURNING id, delivered_at::text AS delivered_at`,
          [params.rawBody, JSON.stringify(safeHeaders)],
        );
        deliveryId = insRes.rows[0].id;
        deliveredAt = insRes.rows[0].delivered_at;

        await client1.query(
          `INSERT INTO app.webhook_delivery_outcomes (delivery_id, delivered_at, outcome, reason, error_code)
           VALUES ($1, $2, 'ignored', 'Malformed JSON syntax', 'JSON_SYNTAX_ERROR')`,
          [deliveryId, deliveredAt],
        );

        await client1.query('COMMIT');
        return { statusCode: 200, outcome: 'ignored', reason: 'Malformed JSON syntax', deliveryId };
      }

      triggerEvent = typeof params.parsedBody?.triggerEvent === 'string' ? params.parsedBody.triggerEvent.trim() : null;

      if (!triggerEvent) {
        // Path B: Missing triggerEvent
        const insRes = await client1.query(
          `INSERT INTO app.webhook_deliveries (gateway, raw_payload_bytes, headers)
           VALUES ('calcom', $1, $2::jsonb)
           RETURNING id, delivered_at::text AS delivered_at`,
          [params.rawBody, JSON.stringify(safeHeaders)],
        );
        deliveryId = insRes.rows[0].id;
        deliveredAt = insRes.rows[0].delivered_at;

        await client1.query(
          `INSERT INTO app.webhook_delivery_outcomes (delivery_id, delivered_at, outcome, reason, error_code)
           VALUES ($1, $2, 'ignored', 'Missing or invalid triggerEvent', 'INVALID_ENVELOPE')`,
          [deliveryId, deliveredAt],
        );

        await client1.query('COMMIT');
        return { statusCode: 200, outcome: 'ignored', reason: 'Missing triggerEvent', deliveryId };
      }

      const supportedTriggers = ['BOOKING_CREATED', 'BOOKING_RESCHEDULED', 'BOOKING_CANCELLED'];
      if (!supportedTriggers.includes(triggerEvent)) {
        // Path C: Unsupported triggerEvent
        const insRes = await client1.query(
          `INSERT INTO app.webhook_deliveries (gateway, raw_payload_bytes, headers)
           VALUES ('calcom', $1, $2::jsonb)
           RETURNING id, delivered_at::text AS delivered_at`,
          [params.rawBody, JSON.stringify(safeHeaders)],
        );
        deliveryId = insRes.rows[0].id;
        deliveredAt = insRes.rows[0].delivered_at;

        await client1.query(
          `INSERT INTO app.webhook_delivery_outcomes (delivery_id, delivered_at, outcome, reason, error_code)
           VALUES ($1, $2, 'ignored', $3, 'UNSUPPORTED_TRIGGER')`,
          [deliveryId, deliveredAt, `Unsupported triggerEvent: ${triggerEvent}`],
        );

        await client1.query('COMMIT');
        return { statusCode: 200, outcome: 'ignored', reason: `Unsupported triggerEvent: ${triggerEvent}`, deliveryId };
      }

      bookingUid = typeof params.parsedBody?.payload?.uid === 'string' ? params.parsedBody.payload.uid.trim() : null;
      if (!bookingUid) {
        // Path D: Missing booking UID
        const insRes = await client1.query(
          `INSERT INTO app.webhook_deliveries (gateway, raw_payload_bytes, headers)
           VALUES ('calcom', $1, $2::jsonb)
           RETURNING id, delivered_at::text AS delivered_at`,
          [params.rawBody, JSON.stringify(safeHeaders)],
        );
        deliveryId = insRes.rows[0].id;
        deliveredAt = insRes.rows[0].delivered_at;

        await client1.query(
          `INSERT INTO app.webhook_delivery_outcomes (delivery_id, delivered_at, outcome, reason, error_code)
           VALUES ($1, $2, 'quarantined', 'Missing booking UID in supported event payload', 'MISSING_BOOKING_UID')`,
          [deliveryId, deliveredAt],
        );

        await client1.query('COMMIT');
        return { statusCode: 200, outcome: 'quarantined', reason: 'Missing booking UID', deliveryId };
      }

      if (triggerEvent === 'BOOKING_RESCHEDULED') {
        predecessorUid = typeof params.parsedBody?.payload?.rescheduleUid === 'string'
          ? params.parsedBody.payload.rescheduleUid.trim()
          : null;

        if (!predecessorUid) {
          // If rescheduleUid is missing, do not conflate key
          const insRes = await client1.query(
            `INSERT INTO app.webhook_deliveries (gateway, raw_payload_bytes, headers)
             VALUES ('calcom', $1, $2::jsonb)
             RETURNING id, delivered_at::text AS delivered_at`,
            [params.rawBody, JSON.stringify(safeHeaders)],
          );
          deliveryId = insRes.rows[0].id;
          deliveredAt = insRes.rows[0].delivered_at;

          await client1.query(
            `INSERT INTO app.webhook_delivery_outcomes (delivery_id, delivered_at, outcome, reason, error_code)
             VALUES ($1, $2, 'quarantined', 'Missing rescheduleUid in BOOKING_RESCHEDULED payload', 'MISSING_RESCHEDULE_UID')`,
            [deliveryId, deliveredAt],
          );

          await client1.query('COMMIT');
          return { statusCode: 200, outcome: 'quarantined', reason: 'Missing rescheduleUid', deliveryId };
        }

        eventKey = `calcom:BOOKING_RESCHEDULED:${predecessorUid}:${bookingUid}`;
      } else {
        eventKey = `calcom:${triggerEvent}:${bookingUid}`;
      }

      sanitizedPayload = params.parsedBody.payload;
      const canonicalJson = canonicalStringify(sanitizedPayload);
      payloadHash = crypto.createHash('sha256').update(canonicalJson).digest('hex');

      // Insert delivery with event_key
      const delRes = await client1.query(
        `INSERT INTO app.webhook_deliveries (gateway, event_key, payload_hash, raw_payload_bytes, headers)
         VALUES ('calcom', $1, $2, $3, $4::jsonb)
         RETURNING id, delivered_at::text AS delivered_at`,
        [eventKey, payloadHash, params.rawBody, JSON.stringify(safeHeaders)],
      );
      deliveryId = delRes.rows[0].id;
      deliveredAt = delRes.rows[0].delivered_at;

      // Upsert canonical inbox
      await client1.query(
        `INSERT INTO app.webhook_inbox (
           gateway, event_key, event_type, booking_uid, payload_hash,
           sanitized_payload, first_delivery_id, first_delivered_at,
           last_delivery_id, last_delivered_at, delivery_count, status
         ) VALUES (
           'calcom', $1, $2, $3, $4,
           $5::jsonb, $6, $7,
           $6, $7, 1, 'received'
         )
         ON CONFLICT (gateway, event_key) DO UPDATE SET
           last_delivery_id = EXCLUDED.last_delivery_id,
           last_delivered_at = EXCLUDED.last_delivered_at,
           delivery_count = app.webhook_inbox.delivery_count + 1`,
        [
          eventKey,
          triggerEvent,
          bookingUid,
          payloadHash,
          JSON.stringify(sanitizedPayload),
          deliveryId,
          deliveredAt,
        ],
      );

      await client1.query('COMMIT');
    } catch (err: any) {
      await client1.query('ROLLBACK').catch(() => {});
      this.logger.error(`Tx 1 failure in Cal.com webhook ingestion: ${err.message}`, err.stack);
      throw err;
    } finally {
      client1.release();
    }

    // --- TRANSACTION 2: Domain Mutations & Outcome Journaling (With Lineage Lock & Restart Loop) ---
    return this.executeDomainProcessingWithRetry({
      deliveryId,
      deliveredAt,
      eventKey: eventKey!,
      eventPayloadHash: payloadHash!,
      triggerEvent: triggerEvent!,
      bookingUid: bookingUid!,
      predecessorUid,
      sanitizedPayload,
      ip: params.ip,
      userAgent: params.userAgent,
      requestId: params.requestId,
    });
  }

  private async executeDomainProcessingWithRetry(ctx: {
    deliveryId: string;
    deliveredAt: string;
    eventKey: string;
    eventPayloadHash: string;
    triggerEvent: string;
    bookingUid: string;
    predecessorUid: string | null;
    sanitizedPayload: any;
    ip?: string | undefined;
    userAgent?: string | undefined;
    requestId?: string | undefined;
  }): Promise<WebhookProcessResult> {
    const maxRestarts = 5;
    let knownUids = new Set<string>([ctx.bookingUid]);
    if (ctx.predecessorUid) {
      knownUids.add(ctx.predecessorUid);
    }

    for (let attempt = 0; attempt < maxRestarts; attempt++) {
      const client2: PoolClient = await this.platformPool.connect();
      let restartNeeded = false;

      try {
        await client2.query('BEGIN');
        await client2.query("SELECT set_config('app.is_platform', 'true', true)");

        // 1. Acquire Event Lock (Namespace 1)
        await client2.query(`SELECT pg_advisory_xact_lock(1, hashtext($1))`, [ctx.eventKey]);

        // 2. Claim and inspect inbox row
        const inboxRes = await client2.query(
          `SELECT * FROM app.webhook_inbox WHERE gateway = 'calcom' AND event_key = $1 FOR UPDATE`,
          [ctx.eventKey],
        );

        if (inboxRes.rows.length === 0) {
          // Should not happen since Tx 1 committed
          await client2.query('COMMIT');
          return { statusCode: 200, outcome: 'ignored', reason: 'Canonical inbox row not found', deliveryId: ctx.deliveryId };
        }

        const inboxRow = inboxRes.rows[0];

        // Sub-case A: Payload Hash Mismatch -> Quarantine this delivery attempt
        if (inboxRow.payload_hash !== ctx.eventPayloadHash) {
          await client2.query(
            `INSERT INTO app.webhook_delivery_outcomes (delivery_id, delivered_at, outcome, reason, error_code)
             VALUES ($1, $2, 'quarantined', 'Payload hash mismatch against canonical event', 'PAYLOAD_HASH_MISMATCH')
             ON CONFLICT (delivery_id, delivered_at) DO NOTHING`,
            [ctx.deliveryId, ctx.deliveredAt],
          );

          await appendAuditEvent(client2, {
            actorId: null,
            actorRole: 'system',
            orgId: null,
            action: 'webhook.delivery_quarantined',
            entity: 'webhook_delivery',
            entityId: ctx.deliveryId,
            after: { eventKey: ctx.eventKey, canonicalHash: inboxRow.payload_hash, receivedHash: ctx.eventPayloadHash },
            ip: ctx.ip,
            userAgent: ctx.userAgent,
            requestId: ctx.requestId,
          });

          await client2.query('COMMIT');
          return { statusCode: 200, outcome: 'quarantined', reason: 'Payload hash mismatch', deliveryId: ctx.deliveryId };
        }

        // Sub-case B: Exact duplicate redelivery after canonical event is already processed
        if (inboxRow.status === 'processed') {
          await client2.query(
            `INSERT INTO app.webhook_delivery_outcomes (delivery_id, delivered_at, outcome, reason, error_code)
             VALUES ($1, $2, 'duplicate_processed', 'Exact duplicate redelivery of processed event', 'DUPLICATE_PROCESSED')
             ON CONFLICT (delivery_id, delivered_at) DO NOTHING`,
            [ctx.deliveryId, ctx.deliveredAt],
          );

          await client2.query('COMMIT');
          return { statusCode: 200, outcome: 'duplicate_processed', deliveryId: ctx.deliveryId };
        }

        // Sub-case C: Normal Processing (status = 'received')
        // Reconcile any prior interrupted deliveries for this canonical event
        await client2.query(
          `INSERT INTO app.webhook_delivery_outcomes (delivery_id, delivered_at, outcome, reason, error_code)
           SELECT d.id, d.delivered_at, 'failed', 'Interrupted by worker failure prior to completion; superseded by retry', 'SUPERSEDED_BY_RETRY'
           FROM app.webhook_deliveries d
           LEFT JOIN app.webhook_delivery_outcomes o ON o.delivery_id = d.id AND o.delivered_at = d.delivered_at
           WHERE d.event_key = $1
             AND o.delivery_id IS NULL
             AND (d.id, d.delivered_at) <> ($2, $3)
           ON CONFLICT (delivery_id, delivered_at) DO NOTHING`,
          [ctx.eventKey, ctx.deliveryId, ctx.deliveredAt],
        );

        // 3. Lineage Lock Protocol: Lexicographically sort all known UIDs
        const sortedUids = Array.from(knownUids).sort();
        for (const uid of sortedUids) {
          await client2.query(`SELECT pg_advisory_xact_lock(2, hashtext($1))`, [uid]);
        }

        // 4. Lineage Revalidation: Discover any edges not previously in knownUids
        const revalRes = await client2.query(
          `SELECT uid, predecessor_uid, rescheduled_to_uid
           FROM app.lead_bookings
           WHERE uid = ANY($1::text[])
              OR predecessor_uid = ANY($1::text[])
              OR rescheduled_to_uid = ANY($1::text[])`,
          [sortedUids],
        );

        const discovered = new Set<string>(knownUids);
        for (const row of revalRes.rows) {
          if (row.uid) discovered.add(row.uid);
          if (row.predecessor_uid) discovered.add(row.predecessor_uid);
          if (row.rescheduled_to_uid) discovered.add(row.rescheduled_to_uid);
        }

        // Check if any discovered UID sorts before the highest held UID
        const highestHeld = sortedUids.length > 0 ? sortedUids[sortedUids.length - 1] : '';
        let hasEarlierUid = false;
        for (const uid of discovered) {
          if (!knownUids.has(uid)) {
            if (highestHeld && uid < highestHeld) {
              hasEarlierUid = true;
            }
            knownUids.add(uid);
          }
        }

        if (hasEarlierUid) {
          // Restart-on-discovery invariant: ABORT the entire transaction to release locks, then restart
          await client2.query('ROLLBACK');
          restartNeeded = true;
          continue; // retry loop
        }

        // 5. Execute Domain Mutations
        await this.mutateDomainRecords({
          client: client2,
          ctx,
          inboxRow,
        });

        // 6. Mark inbox processed and record terminal outcome
        await client2.query(
          `UPDATE app.webhook_inbox
           SET status = 'processed', processed_at = clock_timestamp()
           WHERE gateway = 'calcom' AND event_key = $1`,
          [ctx.eventKey],
        );

        await client2.query(
          `INSERT INTO app.webhook_delivery_outcomes (delivery_id, delivered_at, outcome, reason)
           VALUES ($1, $2, 'processed', 'Successfully processed booking mutation')
           ON CONFLICT (delivery_id, delivered_at) DO NOTHING`,
          [ctx.deliveryId, ctx.deliveredAt],
        );

        await client2.query('COMMIT');
        return { statusCode: 200, outcome: 'processed', deliveryId: ctx.deliveryId };
      } catch (err: any) {
        await client2.query('ROLLBACK').catch(() => {});
        this.logger.error(`Tx 2 domain mutation failed for ${ctx.eventKey}: ${err.message}`, err.stack);
        throw err;
      } finally {
        client2.release();
      }
    }

    throw new Error(`Exceeded max lock acquisition restarts for event ${ctx.eventKey}`);
  }

  private async mutateDomainRecords(params: {
    client: PoolClient;
    ctx: {
      deliveryId: string;
      eventKey: string;
      triggerEvent: string;
      bookingUid: string;
      predecessorUid: string | null;
      sanitizedPayload: any;
      ip?: string | undefined;
      userAgent?: string | undefined;
      requestId?: string | undefined;
    };
    inboxRow: any;
  }): Promise<void> {
    const { client, ctx } = params;
    const p = ctx.sanitizedPayload;

    // Extract email from payload attendees
    let email: string | null = null;
    let name: string | null = null;

    if (Array.isArray(p.attendees) && p.attendees.length > 0) {
      email = p.attendees[0].email?.toLowerCase().trim() || null;
      name = p.attendees[0].name?.trim() || null;
    } else if (typeof p.email === 'string') {
      email = p.email.toLowerCase().trim();
    }

    const company = p.responses?.company?.value || p.company || null;
    const calcomBookingId = p.id ? String(p.id) : ctx.bookingUid;
    const title = p.title || 'Sales Consultation';
    const description = p.description || null;
    const startTime = p.startTime ? new Date(p.startTime) : new Date();
    const endTime = p.endTime ? new Date(p.endTime) : new Date(startTime.getTime() + 30 * 60 * 1000);
    const location = p.location || null;
    const meetingUrl = p.meetingUrl || null;
    const cancellationReason = p.cancellationReason || null;
    const utm = p.metadata?.utm || p.utm || {};

    // Handle out-of-order cancellation resilience
    if (ctx.triggerEvent === 'BOOKING_CANCELLED') {
      // 1. Check if booking exists
      const existingB = await client.query(
        `SELECT id, lead_id FROM app.lead_bookings WHERE uid = $1 FOR UPDATE`,
        [ctx.bookingUid],
      );

      if (existingB.rows.length === 0) {
        // Booking does not exist yet! Persist cancellation tombstone
        await client.query(
          `INSERT INTO app.booking_tombstones (uid, status, cancellation_reason, cancelled_at)
           VALUES ($1, 'CANCELLED', $2, clock_timestamp())
           ON CONFLICT (uid) DO UPDATE SET cancellation_reason = EXCLUDED.cancellation_reason`,
          [ctx.bookingUid, cancellationReason],
        );

        await appendAuditEvent(client, {
          actorId: null,
          actorRole: 'system',
          orgId: null,
          action: 'lead.meeting_cancellation_tombstoned',
          entity: 'booking_tombstone',
          entityId: ctx.bookingUid,
          after: { uid: ctx.bookingUid, reason: cancellationReason },
          ip: ctx.ip,
          userAgent: ctx.userAgent,
          requestId: ctx.requestId,
        });
        return;
      }

      const bookingRow = existingB.rows[0];

      // Booking exists: mark CANCELLED
      await client.query(
        `UPDATE app.lead_bookings
         SET status = 'CANCELLED', cancellation_reason = $1, updated_at = clock_timestamp()
         WHERE id = $2`,
        [cancellationReason, bookingRow.id],
      );

      // Clear active_booking_id on lead if it pointed to this booking
      await client.query(
        `UPDATE app.leads
         SET active_booking_id = NULL, updated_at = clock_timestamp()
         WHERE id = $1 AND active_booking_id = $2`,
        [bookingRow.lead_id, bookingRow.id],
      );

      await appendAuditEvent(client, {
        actorId: null,
        actorRole: 'system',
        orgId: null,
        action: 'lead.meeting_cancelled',
        entity: 'lead',
        entityId: bookingRow.lead_id,
        after: { bookingId: bookingRow.id, uid: ctx.bookingUid, cancellationReason },
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        requestId: ctx.requestId,
      });
      return;
    }

    // For BOOKING_CREATED or BOOKING_RESCHEDULED:
    if (!email) {
      // If email is missing from payload, attempt to resolve via predecessor booking
      if (ctx.predecessorUid) {
        const predRes = await client.query(
          `SELECT l.email, l.name FROM app.lead_bookings b JOIN app.leads l ON l.id = b.lead_id WHERE b.uid = $1`,
          [ctx.predecessorUid],
        );
        if (predRes.rows.length > 0) {
          email = predRes.rows[0].email;
          if (!name) name = predRes.rows[0].name;
        }
      }
    }

    if (!email) {
      throw new Error(`Cannot process booking ${ctx.bookingUid}: attendee email could not be resolved`);
    }

    // Lock email in Namespace 3
    await client.query(`SELECT pg_advisory_xact_lock(3, hashtext($1))`, [email]);

    // Upsert Lead
    const leadRes = await client.query(
      `INSERT INTO app.leads (email, name, company, calcom_booking_id, utm, stage)
       VALUES ($1, $2, $3, $4, $5::jsonb, 'meeting_booked')
       ON CONFLICT (email) DO UPDATE SET
         name = COALESCE(EXCLUDED.name, app.leads.name),
         company = COALESCE(EXCLUDED.company, app.leads.company),
         calcom_booking_id = EXCLUDED.calcom_booking_id,
         utm = CASE WHEN EXCLUDED.utm = '{}'::jsonb THEN app.leads.utm ELSE EXCLUDED.utm END,
         stage = 'meeting_booked',
         updated_at = clock_timestamp()
       RETURNING id`,
      [email, name, company, calcomBookingId, JSON.stringify(utm)],
    );
    const leadId = leadRes.rows[0].id;

    // Check if a cancellation tombstone already exists for this booking UID
    const tombstoneRes = await client.query(
      `SELECT * FROM app.booking_tombstones WHERE uid = $1`,
      [ctx.bookingUid],
    );
    const isTombstoned = tombstoneRes.rows.length > 0;
    const initialStatus = isTombstoned ? 'CANCELLED' : 'ACCEPTED';
    const initialCancelReason = isTombstoned ? tombstoneRes.rows[0].cancellation_reason : null;

    if (ctx.triggerEvent === 'BOOKING_RESCHEDULED' && ctx.predecessorUid) {
      // Mark predecessor RESCHEDULED
      await client.query(
        `UPDATE app.lead_bookings
         SET status = 'RESCHEDULED', rescheduled_to_uid = $1, updated_at = clock_timestamp()
         WHERE uid = $2`,
        [ctx.bookingUid, ctx.predecessorUid],
      );
    }

    // Insert successor booking
    const bookRes = await client.query(
      `INSERT INTO app.lead_bookings (
         lead_id, calcom_booking_id, uid, predecessor_uid, status,
         title, description, start_time, end_time, location, meeting_url,
         cancellation_reason, raw_booking_data
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8, $9, $10, $11,
         $12, $13::jsonb
       )
       ON CONFLICT (uid) DO UPDATE SET
         status = EXCLUDED.status,
         start_time = EXCLUDED.start_time,
         end_time = EXCLUDED.end_time,
         updated_at = clock_timestamp()
       RETURNING id`,
      [
        leadId,
        calcomBookingId,
        ctx.bookingUid,
        ctx.predecessorUid,
        initialStatus,
        title,
        description,
        startTime,
        endTime,
        location,
        meetingUrl,
        initialCancelReason,
        JSON.stringify(p),
      ],
    );
    const newBookingId = bookRes.rows[0].id;

    // Update active booking pointer on lead
    if (!isTombstoned) {
      await client.query(
        `UPDATE app.leads SET active_booking_id = $1, updated_at = clock_timestamp() WHERE id = $2`,
        [newBookingId, leadId],
      );
    } else {
      // If the successor booking was already cancelled (tombstoned), clear active_booking_id on lead
      await client.query(
        `UPDATE app.leads SET active_booking_id = NULL, updated_at = clock_timestamp() WHERE id = $1`,
        [leadId],
      );
    }

    const auditAction = ctx.triggerEvent === 'BOOKING_RESCHEDULED'
      ? 'lead.meeting_rescheduled'
      : 'lead.meeting_booked';

    await appendAuditEvent(client, {
      actorId: null,
      actorRole: 'system',
      orgId: null,
      action: auditAction,
      entity: 'lead',
      entityId: leadId,
      after: {
        leadId,
        bookingId: newBookingId,
        uid: ctx.bookingUid,
        status: initialStatus,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });
  }
}

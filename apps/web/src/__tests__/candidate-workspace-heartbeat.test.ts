import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  executeHeartbeatPing,
  DEFAULT_HEARTBEAT_INTERVAL_MS,
} from '../hooks/workspace/use-activity-heartbeat';

describe('useActivityHeartbeat hook & execution engine (I174, BR-08, BR-11)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('exports default interval of 30,000 ms (30s) per product specification', () => {
    expect(DEFAULT_HEARTBEAT_INTERVAL_MS).toBe(30_000);
  });

  it('executeHeartbeatPing posts to BFF endpoint and returns success payload', async () => {
    let capturedUrl = '';
    let capturedMethod = '';

    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (req: any, init?: any) => {
      capturedUrl = typeof req === 'string' ? req : req.url;
      capturedMethod = init?.method || 'GET';
      return new Response(
        JSON.stringify({
          success: true,
          serverTimeUtc: '2026-11-06T10:00:00.000Z',
          workspaceStatus: 'connected',
          assignmentStatus: 'in_progress',
          remainingMs: 3_600_000,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const result = await executeHeartbeatPing('ws-valid-123');

    expect(capturedUrl).toBe('/api/candidate/workspace/ws-valid-123/heartbeat');
    expect(capturedMethod).toBe('POST');
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.isTerminal).toBe(false);
    expect(result.data.workspaceStatus).toBe('connected');
    expect(result.data.remainingMs).toBe(3_600_000);
  });

  it('properly encodes special characters in workspace ID parameter', async () => {
    let capturedUrl = '';

    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (req: any) => {
      capturedUrl = typeof req === 'string' ? req : req.url;
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await executeHeartbeatPing('ws#123?test=true');
    expect(capturedUrl).toBe('/api/candidate/workspace/ws%23123%3Ftest%3Dtrue/heartbeat');
  });

  it('identifies 409 Conflict as terminal submission state', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async () => {
      return new Response(
        JSON.stringify({
          title: 'Conflict',
          status: 409,
          detail: 'Assessment has already been submitted',
          code: 'ALREADY_SUBMITTED',
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const result = await executeHeartbeatPing('ws-submitted');

    expect(result.ok).toBe(false);
    expect(result.status).toBe(409);
    expect(result.isTerminal).toBe(true);
    expect(result.terminalReason).toBe('ALREADY_SUBMITTED');
  });

  it('identifies 410 Gone as terminal expired session state', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async () => {
      return new Response(
        JSON.stringify({
          title: 'Gone',
          status: 410,
          detail: 'Assessment deadline has passed',
          code: 'SESSION_EXPIRED',
        }),
        { status: 410, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const result = await executeHeartbeatPing('ws-expired');

    expect(result.ok).toBe(false);
    expect(result.status).toBe(410);
    expect(result.isTerminal).toBe(true);
    expect(result.terminalReason).toBe('SESSION_EXPIRED');
  });

  it('identifies assignmentStatus = submitted in response body as terminal state', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          workspaceStatus: 'ended',
          assignmentStatus: 'submitted',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const result = await executeHeartbeatPing('ws-auto-submitted');

    expect(result.isTerminal).toBe(true);
    expect(result.terminalReason).toBe('submitted');
  });

  it('identifies assignmentStatus = expired in response body as terminal state', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          workspaceStatus: 'ended',
          assignmentStatus: 'expired',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const result = await executeHeartbeatPing('ws-timeout');

    expect(result.isTerminal).toBe(true);
    expect(result.terminalReason).toBe('expired');
  });

  it('identifies assignmentStatus = revoked in response body as terminal state', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          workspaceStatus: 'ended',
          assignmentStatus: 'revoked',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const result = await executeHeartbeatPing('ws-revoked');

    expect(result.isTerminal).toBe(true);
    expect(result.terminalReason).toBe('revoked');
  });

  it('handles transient network failures without throwing uncaught exceptions', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network request failed'));

    await expect(executeHeartbeatPing('ws-network-error')).rejects.toThrow('Network request failed');
  });

  it('forwards AbortSignal to underlying fetch call', async () => {
    const controller = new AbortController();
    let capturedSignal: AbortSignal | undefined;

    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (_req, init) => {
      capturedSignal = init?.signal as AbortSignal;
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await executeHeartbeatPing('ws-abort', controller.signal);
    expect(capturedSignal).toBe(controller.signal);
  });
});

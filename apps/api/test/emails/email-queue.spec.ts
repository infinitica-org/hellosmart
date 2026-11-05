import { describe, expect, it } from 'vitest';
import {
  EMAIL_BACKOFF_MS,
  isPermanentEmailFailure,
  nextEmailDelayMs,
  renderEmail,
} from '../../src/modules/emails/email.service.js';

describe('Transactional email templates and backoff (S1-T06)', () => {
  it('renders HTML and text with a HelloSmart mark when no company logo is set', () => {
    const rendered = renderEmail('candidate-invite', {
      candidateName: 'Asha <script>',
      companyName: 'Northwind',
      assessmentName: 'Support simulation',
      actionUrl: 'https://app.hellosmart.ai/reset?token=abc',
      expiresAtFormatted: 'Nov 8, 2026, 9:00 PM',
      durationMinutes: '90',
      logoUrl: '',
    });
    expect(rendered.html).toContain('HelloSmart');
    expect(rendered.html).not.toContain('<script>');
    expect(rendered.html).toContain('Asha &lt;script&gt;');
    expect(rendered.html).toContain('bgcolor="#ea580c"');
    expect(rendered.text).toContain('https://app.hellosmart.ai/reset?token=abc');
    expect(rendered.text).toContain('Northwind');
  });

  it('keeps a company logo when a URL is provided', () => {
    const rendered = renderEmail('password-reset', {
      candidateName: 'Asha',
      companyName: 'Northwind',
      assessmentName: '',
      actionUrl: 'https://app.hellosmart.ai/reset',
      expiresAtFormatted: 'Nov 8, 2026',
      durationMinutes: '',
      logoUrl: 'https://cdn.example/logo.png',
    });
    expect(rendered.html).toContain('https://cdn.example/logo.png');
  });

  it('retries transient failures on 1m, 5m, 15m, 30m, then 1h and treats bounces as terminal', () => {
    expect([...EMAIL_BACKOFF_MS]).toEqual([60_000, 300_000, 900_000, 1_800_000, 3_600_000]);
    expect(nextEmailDelayMs(1)).toBe(60_000);
    expect(nextEmailDelayMs(5)).toBe(3_600_000);
    expect(isPermanentEmailFailure(new Error('550 mailbox unavailable'))).toBe(true);
    expect(isPermanentEmailFailure(new Error('socket hang up'))).toBe(false);
  });
});

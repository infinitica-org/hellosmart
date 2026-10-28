import crypto from 'node:crypto';
import type { EmailSender } from './index.js';

export interface SentEmailRecord {
  providerId: string;
  to: string;
  template: string;
  vars: Record<string, string>;
  orgId?: string;
  sentAt: Date;
}

export class FakeEmailSender implements EmailSender {
  private sentEmails: SentEmailRecord[] = [];

  async send(input: {
    to: string;
    template: string;
    vars: Record<string, string>;
    orgId?: string;
  }): Promise<{ providerId: string }> {
    const providerId = `email_fake_${crypto.randomUUID()}`;
    const record: SentEmailRecord = {
      ...input,
      providerId,
      sentAt: new Date(),
    };
    this.sentEmails.push(record);
    return { providerId };
  }

  getSentEmails(): SentEmailRecord[] {
    return [...this.sentEmails];
  }

  getLastEmail(): SentEmailRecord | undefined {
    return this.sentEmails[this.sentEmails.length - 1];
  }

  findEmailsTo(to: string): SentEmailRecord[] {
    return this.sentEmails.filter((e) => e.to.toLowerCase() === to.toLowerCase());
  }

  clear(): void {
    this.sentEmails = [];
  }
}

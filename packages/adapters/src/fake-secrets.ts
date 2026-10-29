import crypto from 'node:crypto';
import type { SecretStore } from './index.js';

export interface FakeSecretRecord {
  ref: string;
  orgId: string;
  name: string;
  plaintext: string;
  last4: string;
  createdAt: Date;
}

export class FakeSecretStore implements SecretStore {
  private secrets = new Map<string, FakeSecretRecord>();

  /**
   * Returns plaintext only into process memory. Never log the result.
   */
  async get(ref: string): Promise<string> {
    const record = this.secrets.get(ref);
    if (!record) {
      throw new Error(`Secret not found: ${ref}`);
    }
    return record.plaintext;
  }

  async put(input: {
    orgId: string;
    name: string;
    value: string;
  }): Promise<{ ref: string; last4: string }> {
    const ref = `sec_fake_${crypto.randomUUID()}`;
    const last4 = input.value.length >= 4 ? input.value.slice(-4) : input.value.padStart(4, '*');

    const record: FakeSecretRecord = {
      ref,
      orgId: input.orgId,
      name: input.name,
      plaintext: input.value,
      last4,
      createdAt: new Date(),
    };

    this.secrets.set(ref, record);
    return { ref, last4 };
  }

  async delete(ref: string): Promise<void> {
    this.secrets.delete(ref);
  }

  getSecretMetadata(ref: string): Omit<FakeSecretRecord, 'plaintext'> | undefined {
    const record = this.secrets.get(ref);
    if (!record) return undefined;
    const { plaintext: _ignored, ...meta } = record;
    return meta;
  }

  clear(): void {
    this.secrets.clear();
  }
}

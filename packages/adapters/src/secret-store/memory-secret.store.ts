import type { SecretStore } from '../index.js';

export class MemorySecretStore implements SecretStore {
  private readonly secrets = new Map<string, string>();

  async get(ref: string): Promise<string> {
    const val = this.secrets.get(ref);
    if (val === undefined) {
      throw new Error(`ResourceNotFoundException: Secret '${ref}' not found in memory store`);
    }
    return val;
  }

  async put(input: { orgId: string; name: string; value: string }): Promise<{ ref: string; last4: string }> {
    const ref = `hs/${input.orgId}/${input.name}`;
    this.secrets.set(ref, input.value);
    const last4 = input.value.slice(-4) || '****';
    return { ref, last4 };
  }

  async delete(ref: string): Promise<void> {
    this.secrets.delete(ref);
  }

  set(ref: string, value: string): void {
    this.secrets.set(ref, value);
  }
}

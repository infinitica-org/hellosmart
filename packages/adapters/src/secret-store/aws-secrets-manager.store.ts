import { Buffer } from 'node:buffer';
import process from 'node:process';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
  CreateSecretCommand,
  PutSecretValueCommand,
  DeleteSecretCommand,
  type SecretsManagerClientConfig,
} from '@aws-sdk/client-secrets-manager';
import type { SecretStore } from '../index.js';

export interface AwsSecretsManagerStoreOptions {
  region?: string | undefined;
  endpoint?: string | undefined;
  client?: SecretsManagerClient | undefined;
}

export class AwsSecretsManagerStore implements SecretStore {
  private readonly client: SecretsManagerClient;

  constructor(options: AwsSecretsManagerStoreOptions = {}) {
    if (options.client) {
      this.client = options.client;
    } else {
      const clientConfig: SecretsManagerClientConfig = {
        region: options.region ?? process.env.AWS_REGION ?? 'ap-south-1',
      };
      const endpoint = options.endpoint ?? process.env.AWS_SECRETS_MANAGER_ENDPOINT;
      if (endpoint) {
        clientConfig.endpoint = endpoint;
      }
      this.client = new SecretsManagerClient(clientConfig);
    }
  }

  /**
   * Resolves secret value by opaque reference/ARN into ephemeral process memory.
   * NEVER logs the returned secret string.
   */
  async get(ref: string): Promise<string> {
    if (!ref || typeof ref !== 'string' || ref.trim().length === 0) {
      throw new Error('Secret reference identifier must be a non-empty string');
    }

    try {
      const command = new GetSecretValueCommand({ SecretId: ref.trim() });
      const response = await this.client.send(command);

      let secretValue: string | undefined;

      if (response.SecretString !== undefined) {
        secretValue = response.SecretString;
      } else if (response.SecretBinary !== undefined) {
        secretValue = Buffer.from(response.SecretBinary).toString('utf8');
      }

      if (secretValue === undefined || secretValue === null) {
        throw new Error(`Secret '${ref}' exists but contains no SecretString or SecretBinary`);
      }

      // Check if stored as JSON object (e.g. { "seed": "...", "totp_seed": "...", "secret": "..." })
      const trimmed = secretValue.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const parsed = JSON.parse(trimmed) as Record<string, unknown>;
          if (typeof parsed.seed === 'string' && parsed.seed.trim().length > 0) {
            return parsed.seed.trim();
          }
          if (typeof parsed.totp_seed === 'string' && parsed.totp_seed.trim().length > 0) {
            return parsed.totp_seed.trim();
          }
          if (typeof parsed.secret === 'string' && parsed.secret.trim().length > 0) {
            return parsed.secret.trim();
          }
          if (typeof parsed.value === 'string' && parsed.value.trim().length > 0) {
            return parsed.value.trim();
          }
        } catch {
          // If JSON parse fails, return the trimmed raw string
        }
      }

      return trimmed;
    } catch (err: unknown) {
      // Re-throw without leaking secret contents
      const errName = err && typeof err === 'object' && 'name' in err ? String(err.name) : 'Error';
      const errMsg = err instanceof Error ? err.message : String(err);
      throw new Error(`AWS Secrets Manager error resolving '${ref}': [${errName}] ${errMsg}`);
    }
  }

  async put(input: { orgId: string; name: string; value: string }): Promise<{ ref: string; last4: string }> {
    const secretId = `hs/${input.orgId}/${input.name}`;
    const last4 = input.value.slice(-4) || '****';

    try {
      const createCommand = new CreateSecretCommand({
        Name: secretId,
        SecretString: input.value,
        Description: `Managed secret for org ${input.orgId}`,
      });
      const response = await this.client.send(createCommand);
      return { ref: response.ARN ?? response.Name ?? secretId, last4 };
    } catch (createErr: unknown) {
      const isExists =
        createErr && typeof createErr === 'object' && 'name' in createErr && createErr.name === 'ResourceExistsException';
      if (isExists) {
        const putCommand = new PutSecretValueCommand({
          SecretId: secretId,
          SecretString: input.value,
        });
        const putRes = await this.client.send(putCommand);
        return { ref: putRes.ARN ?? putRes.Name ?? secretId, last4 };
      }
      throw createErr;
    }
  }

  async delete(ref: string): Promise<void> {
    const command = new DeleteSecretCommand({
      SecretId: ref,
      RecoveryWindowInDays: 7,
    });
    await this.client.send(command);
  }
}

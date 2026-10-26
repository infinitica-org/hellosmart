import { describe, it, expect, vi } from 'vitest';
import { Buffer } from 'node:buffer';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
  CreateSecretCommand,
  PutSecretValueCommand,
  DeleteSecretCommand,
} from '@aws-sdk/client-secrets-manager';
import { AwsSecretsManagerStore } from '../src/secret-store/aws-secrets-manager.store.js';
import { MemorySecretStore } from '../src/secret-store/memory-secret.store.js';

describe('SecretStore Adapters', () => {
  describe('AwsSecretsManagerStore', () => {
    it('resolves raw string TOTP seed from SecretString', async () => {
      const mockClient = {
        send: vi.fn().mockImplementation(async (command) => {
          if (command instanceof GetSecretValueCommand) {
            expect(command.input.SecretId).toBe('hs/mfa/admin-1');
            return {
              SecretString: 'JBSWY3DPEHPK3PXP',
            };
          }
          throw new Error('Unexpected command');
        }),
      } as unknown as SecretsManagerClient;

      const store = new AwsSecretsManagerStore({ client: mockClient });
      const secret = await store.get('hs/mfa/admin-1');
      expect(secret).toBe('JBSWY3DPEHPK3PXP');
    });

    it('resolves JSON-encoded seed ({ "seed": "..." }) from SecretString', async () => {
      const mockClient = {
        send: vi.fn().mockResolvedValue({
          SecretString: JSON.stringify({ seed: 'JBSWY3DPEHPK3PXP', created_at: '2026-10-26' }),
        }),
      } as unknown as SecretsManagerClient;

      const store = new AwsSecretsManagerStore({ client: mockClient });
      const secret = await store.get('hs/mfa/admin-json');
      expect(secret).toBe('JBSWY3DPEHPK3PXP');
    });

    it('resolves JSON-encoded seed ({ "totp_seed": "..." }) from SecretString', async () => {
      const mockClient = {
        send: vi.fn().mockResolvedValue({
          SecretString: JSON.stringify({ totp_seed: 'JBSWY3DPEHPK3PXP' }),
        }),
      } as unknown as SecretsManagerClient;

      const store = new AwsSecretsManagerStore({ client: mockClient });
      const secret = await store.get('hs/mfa/admin-totp-json');
      expect(secret).toBe('JBSWY3DPEHPK3PXP');
    });

    it('resolves binary secret from SecretBinary', async () => {
      const rawSeed = 'JBSWY3DPEHPK3PXP';
      const mockClient = {
        send: vi.fn().mockResolvedValue({
          SecretBinary: Buffer.from(rawSeed, 'utf8'),
        }),
      } as unknown as SecretsManagerClient;

      const store = new AwsSecretsManagerStore({ client: mockClient });
      const secret = await store.get('hs/mfa/admin-binary');
      expect(secret).toBe('JBSWY3DPEHPK3PXP');
    });

    it('fails closed when reference string is empty or whitespace', async () => {
      const mockClient = { send: vi.fn() } as unknown as SecretsManagerClient;
      const store = new AwsSecretsManagerStore({ client: mockClient });

      await expect(store.get('')).rejects.toThrow('Secret reference identifier must be a non-empty string');
      await expect(store.get('   ')).rejects.toThrow('Secret reference identifier must be a non-empty string');
      expect(mockClient.send).not.toHaveBeenCalled();
    });

    it('fails closed when secret does not exist (ResourceNotFoundException)', async () => {
      const notFoundError = new Error('Secrets Manager can’t find the specified secret.');
      notFoundError.name = 'ResourceNotFoundException';

      const mockClient = {
        send: vi.fn().mockRejectedValue(notFoundError),
      } as unknown as SecretsManagerClient;

      const store = new AwsSecretsManagerStore({ client: mockClient });
      await expect(store.get('hs/mfa/missing')).rejects.toThrow(
        /AWS Secrets Manager error resolving 'hs\/mfa\/missing': \[ResourceNotFoundException\]/,
      );
    });

    it('fails closed when access is denied (AccessDeniedException)', async () => {
      const accessError = new Error('User is not authorized to perform: secretsmanager:GetSecretValue');
      accessError.name = 'AccessDeniedException';

      const mockClient = {
        send: vi.fn().mockRejectedValue(accessError),
      } as unknown as SecretsManagerClient;

      const store = new AwsSecretsManagerStore({ client: mockClient });
      await expect(store.get('hs/mfa/unauthorized')).rejects.toThrow(
        /AWS Secrets Manager error resolving 'hs\/mfa\/unauthorized': \[AccessDeniedException\]/,
      );
    });

    it('fails closed when secret contains neither SecretString nor SecretBinary', async () => {
      const mockClient = {
        send: vi.fn().mockResolvedValue({}),
      } as unknown as SecretsManagerClient;

      const store = new AwsSecretsManagerStore({ client: mockClient });
      await expect(store.get('hs/mfa/empty')).rejects.toThrow(
        /exists but contains no SecretString or SecretBinary/,
      );
    });

    it('put() creates new secret and returns reference with last4', async () => {
      const mockClient = {
        send: vi.fn().mockImplementation(async (command) => {
          if (command instanceof CreateSecretCommand) {
            return {
              ARN: 'arn:aws:secretsmanager:ap-south-1:123456789012:secret:hs/org-1/key-123456',
              Name: 'hs/org-1/key',
            };
          }
          throw new Error('Unexpected command');
        }),
      } as unknown as SecretsManagerClient;

      const store = new AwsSecretsManagerStore({ client: mockClient });
      const result = await store.put({ orgId: 'org-1', name: 'key', value: 'secretValue9999' });

      expect(result.ref).toBe('arn:aws:secretsmanager:ap-south-1:123456789012:secret:hs/org-1/key-123456');
      expect(result.last4).toBe('9999');
    });

    it('put() falls back to PutSecretValue when secret already exists', async () => {
      const existsErr = new Error('The secret already exists');
      existsErr.name = 'ResourceExistsException';

      const mockClient = {
        send: vi.fn().mockImplementation(async (command) => {
          if (command instanceof CreateSecretCommand) {
            throw existsErr;
          }
          if (command instanceof PutSecretValueCommand) {
            return {
              ARN: 'arn:aws:secretsmanager:ap-south-1:123456789012:secret:hs/org-1/existing-123456',
              Name: 'hs/org-1/existing',
            };
          }
          throw new Error('Unexpected command');
        }),
      } as unknown as SecretsManagerClient;

      const store = new AwsSecretsManagerStore({ client: mockClient });
      const result = await store.put({ orgId: 'org-1', name: 'existing', value: 'updatedValue1234' });

      expect(result.ref).toBe('arn:aws:secretsmanager:ap-south-1:123456789012:secret:hs/org-1/existing-123456');
      expect(result.last4).toBe('1234');
    });

    it('delete() schedules secret deletion', async () => {
      const mockClient = {
        send: vi.fn().mockImplementation(async (command) => {
          if (command instanceof DeleteSecretCommand) {
            expect(command.input.SecretId).toBe('hs/org-1/key');
            return { DeletionDate: new Date() };
          }
          throw new Error('Unexpected command');
        }),
      } as unknown as SecretsManagerClient;

      const store = new AwsSecretsManagerStore({ client: mockClient });
      await expect(store.delete('hs/org-1/key')).resolves.toBeUndefined();
    });
  });

  describe('MemorySecretStore', () => {
    it('stores, retrieves, and deletes secrets in memory', async () => {
      const store = new MemorySecretStore();

      await store.put({ orgId: 'org-test', name: 'test-seed', value: 'JBSWY3DPEHPK3PXP' });
      const val = await store.get('hs/org-test/test-seed');
      expect(val).toBe('JBSWY3DPEHPK3PXP');

      await store.delete('hs/org-test/test-seed');
      await expect(store.get('hs/org-test/test-seed')).rejects.toThrow(/not found in memory store/);
    });
  });
});

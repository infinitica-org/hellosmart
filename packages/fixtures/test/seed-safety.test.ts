import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertSeedSafety, runFixtureSeed } from '../dist/seed.js';

describe('Fixture Seed Safety Guard Tests', () => {
  it('production environment always rejects fixture seeding, even with opt-in', () => {
    // 1. NODE_ENV=production with opt-in
    assert.throws(
      () => assertSeedSafety({ nodeEnv: 'production', allowNonProductionSeed: 'true' }),
      /strictly forbidden in production/i,
    );

    // 2. NODE_ENV=prod with opt-in
    assert.throws(
      () => assertSeedSafety({ nodeEnv: 'prod', allowNonProductionSeed: 'true' }),
      /strictly forbidden in production/i,
    );

    // 3. APP_ENV=production with opt-in
    assert.throws(
      () => assertSeedSafety({ nodeEnv: 'development', appEnv: 'production', allowNonProductionSeed: 'true' }),
      /strictly forbidden in production/i,
    );

    // 4. APP_ENV=prod with opt-in
    assert.throws(
      () => assertSeedSafety({ nodeEnv: 'development', appEnv: 'prod', allowNonProductionSeed: 'true' }),
      /strictly forbidden in production/i,
    );
  });

  it('missing opt-in rejects seeding in non-production environments', () => {
    // Missing opt-in (undefined)
    assert.throws(
      () => assertSeedSafety({ nodeEnv: 'development', allowNonProductionSeed: undefined }),
      /requires explicit opt-in via ALLOW_NON_PRODUCTION_SEED=true/i,
    );

    // Opt-in set to 'false'
    assert.throws(
      () => assertSeedSafety({ nodeEnv: 'development', allowNonProductionSeed: 'false' }),
      /requires explicit opt-in via ALLOW_NON_PRODUCTION_SEED=true/i,
    );

    // Opt-in empty string
    assert.throws(
      () => assertSeedSafety({ nodeEnv: 'development', allowNonProductionSeed: '' }),
      /requires explicit opt-in via ALLOW_NON_PRODUCTION_SEED=true/i,
    );
  });

  it('explicit opt-in permits the intended non-production path', () => {
    // String 'true'
    assert.doesNotThrow(() =>
      assertSeedSafety({ nodeEnv: 'development', allowNonProductionSeed: 'true' }),
    );

    // Boolean true
    assert.doesNotThrow(() =>
      assertSeedSafety({ nodeEnv: 'development', allowNonProductionSeed: true }),
    );

    // Test environment
    assert.doesNotThrow(() =>
      assertSeedSafety({ nodeEnv: 'test', allowNonProductionSeed: 'true' }),
    );
  });

  it('guarantees rejection happens strictly before any database connection or mutation', async () => {
    let poolCreated = false;
    let clientConnected = false;

    const mockPoolFactory = () => {
      poolCreated = true;
      return {
        connect: async () => {
          clientConnected = true;
          throw new Error('Should never reach database connect');
        },
      } as any;
    };

    // 1. Rejected due to production environment
    await assert.rejects(
      async () => {
        await runFixtureSeed({
          nodeEnv: 'production',
          allowNonProductionSeed: 'true',
          poolFactory: mockPoolFactory,
        });
      },
      /strictly forbidden in production/i,
    );
    assert.strictEqual(poolCreated, false, 'Pool must not be created on production rejection');
    assert.strictEqual(clientConnected, false, 'Client must not connect on production rejection');

    // 2. Rejected due to missing opt-in
    await assert.rejects(
      async () => {
        await runFixtureSeed({
          nodeEnv: 'development',
          allowNonProductionSeed: undefined,
          poolFactory: mockPoolFactory,
        });
      },
      /requires explicit opt-in via ALLOW_NON_PRODUCTION_SEED=true/i,
    );
    assert.strictEqual(poolCreated, false, 'Pool must not be created when opt-in is missing');
    assert.strictEqual(clientConnected, false, 'Client must not connect when opt-in is missing');
  });
});

import crypto from 'node:crypto';
import pg from '../apps/api/node_modules/pg/lib/index.js';

const SAMPLE_TOKEN = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

async function seed() {
  const pool = new pg.Pool({
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    database: 'hellosmart',
  });

  const orgId = '11111111-1111-1111-1111-111111111111';
  const adminId = '00000000-0000-0000-0000-000000000001';
  const candidateId = '22222222-2222-2222-2222-222222222222';
  const invitationId = '33333333-3333-3333-3333-333333333333';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.is_platform', 'true', true)");

    // Upsert organization
    await client.query(`
      INSERT INTO app.organizations (id, name, slug, status, created_by)
      VALUES ($1, 'Acme Corporation', 'acme-corp', 'paid_active', $2)
      ON CONFLICT (id) DO UPDATE SET name = 'Acme Corporation'
    `, [orgId, adminId]);

    // Upsert entitlements
    await client.query(`
      INSERT INTO app.entitlements (org_id, max_templates, max_candidates)
      VALUES ($1, 10, 100)
      ON CONFLICT (org_id) DO NOTHING
    `, [orgId]);

    // Upsert candidate user
    await client.query(`
      INSERT INTO app.users (id, org_id, email, name, role, status, must_reset_password)
      VALUES ($1, $2, 'jane.doe@example.com', 'Jane Doe', 'candidate', 'invited', true)
      ON CONFLICT (id) DO UPDATE SET status = 'invited', must_reset_password = true
    `, [candidateId, orgId]);

    // Compute token hash using the same algorithm as InvitationsService
    const tokenHash = crypto.createHash('sha256').update(SAMPLE_TOKEN.trim()).digest();

    await client.query(`DELETE FROM app.invitations WHERE email = 'jane.doe@example.com'`);
    await client.query(`
      INSERT INTO app.invitations (id, org_id, user_id, email, role, token_hash, created_at, expires_at, used_at)
      VALUES ($1, $2, $3, 'jane.doe@example.com', 'candidate', $4, now(), now() + interval '71 hours', NULL)
    `, [invitationId, orgId, candidateId, tokenHash]);

    await client.query('COMMIT');
    console.log('✅ Seed completed successfully!');
    console.log(`Sample Token: ${SAMPLE_TOKEN}`);
    console.log(`Candidate: jane.doe@example.com`);
    console.log(`Org: Acme Corporation`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Seed error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();

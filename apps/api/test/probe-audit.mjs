import pg from 'pg';

const url = 'postgres://hs_app:hs_app_local@127.0.0.1:5432/hellosmart';
const pool = new pg.Pool({ connectionString: url, max: 1 });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query("SELECT set_config('app.is_platform', 'true', true)");
  await client.query(
    `INSERT INTO audit.events (
      actor_id, actor_role, org_id, action, entity, entity_id,
      before, after, ip, user_agent, request_id, prev_hash, hash
    ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::inet,$10,$11,$12,$13)`,
    [
      '10000000-0000-4000-8000-000000000001',
      'company_admin',
      '03fa0961-c787-51dd-a4f6-d445495111c6',
      'auth.login.success',
      'user',
      '10000000-0000-4000-8000-000000000001',
      null,
      JSON.stringify({ success: true }),
      '127.0.0.1',
      'probe',
      'req-1',
      null,
      Buffer.from('abc'),
    ],
  );
  await client.query('ROLLBACK');
  console.log('audit insert ok');
} catch (e) {
  console.error('audit err', e);
} finally {
  client.release();
  await pool.end();
}

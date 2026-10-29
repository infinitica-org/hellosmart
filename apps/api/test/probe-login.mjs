import pg from 'pg';
import { verify } from '@node-rs/argon2';

const url = 'postgres://hs_app:hs_app_local@127.0.0.1:5432/hellosmart';
const pool = new pg.Pool({ connectionString: url, max: 1 });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query("SELECT set_config('app.is_platform', 'true', true)");
  const r = await client.query(
    `SELECT u.id, u.password_hash, u.status, o.status AS org_status
     FROM app.users u
     LEFT JOIN app.organizations o ON o.id = u.org_id
     WHERE lower(u.email::text) = $1`,
    ['admin@asterridge.com'],
  );
  console.log('user', r.rows[0]);
  const ok = await verify(r.rows[0].password_hash, 'ChangeMe-Dev-Only-1');
  console.log('verify', ok);
  await client.query('ROLLBACK');
} catch (e) {
  console.error('err', e);
} finally {
  client.release();
  await pool.end();
}

import pg from 'pg';

const url = process.env.DATABASE_URL ?? 'postgres://hs_app:hs_app_local@127.0.0.1:5432/hellosmart';
try {
  const pool = new pg.Pool({ connectionString: url, connectionTimeoutMillis: 3000, max: 1 });
  const client = await pool.connect();
  await client.query("SELECT set_config('app.is_platform', 'true', true)");
  const users = await client.query(`SELECT email::text FROM app.users LIMIT 5`);
  console.log('ok', users.rows);
  client.release();
  await pool.end();
} catch (e) {
  console.error('fail', e);
  process.exit(1);
}

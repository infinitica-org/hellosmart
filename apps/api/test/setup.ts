import 'reflect-metadata';

process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret-test-secret-test-secret-test';
process.env.DATABASE_URL = 'postgres://hs_app:hs_app_local@127.0.0.1:5432/hellosmart';
process.env.DATABASE_PLATFORM_URL =
  process.env.DATABASE_PLATFORM_URL ??
  'postgres://hs_platform:hs_platform_local@127.0.0.1:5432/hellosmart';
process.env.DATABASE_ADMIN_URL =
  process.env.DATABASE_ADMIN_URL ??
  'postgres://hs_owner:hs_owner_local@127.0.0.1:5432/hellosmart';
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.PLATFORM_ADMIN_MFA_SECRET = 'JBSWY3DPEHPK3PXP';

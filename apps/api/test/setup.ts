import 'reflect-metadata';

process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret-test-secret-test-secret-test';
process.env.DATABASE_URL = 'postgres://hs_app:hs_app_local@127.0.0.1:5432/hellosmart';
process.env.CORS_ORIGINS = 'http://localhost:3000';

// Set NODE_ENV to test before any imports
// Load .env.test and override any existing env vars
import { config } from 'dotenv';
import { resolve } from 'path';

// Clear any previously set database/redis vars to ensure test config takes precedence
delete process.env.DB_HOST;
delete process.env.DB_PORT;
delete process.env.DB_NAME;
delete process.env.DB_USER;
delete process.env.DB_PASSWORD;
delete process.env.REDIS_HOST;
delete process.env.REDIS_PORT;
delete process.env.S3_ENDPOINT;
delete process.env.S3_ACCESS_KEY;
delete process.env.S3_SECRET_KEY;
delete process.env.S3_BUCKET;

process.env.NODE_ENV = 'test';
config({ path: resolve(__dirname, '../.env.test') });

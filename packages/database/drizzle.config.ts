import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url:
      process.env.DB_ADMIN_URL ??
      process.env.DATABASE_URL ??
      'postgres://aijh:aijh_dev_password@localhost:5433/aijh',
  },
  strict: true,
  verbose: true,
});

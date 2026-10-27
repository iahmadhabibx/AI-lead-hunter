import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import path from 'node:path';

async function main() {
  const url = process.env.DB_ADMIN_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DB_ADMIN_URL or DATABASE_URL is required to run migrations',
    );
  }

  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  const migrationsFolder = path.join(__dirname, '..', 'migrations');
  console.log(`Applying migrations from ${migrationsFolder}`);
  await migrate(db, { migrationsFolder });
  console.log('Migrations applied successfully');
  await client.end({ timeout: 5 });
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

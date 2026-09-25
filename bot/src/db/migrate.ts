// dotenv MUST load before any other imports that read process.env
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('❌ DATABASE_URL not set. Check your .env file.');
    process.exit(1);
  }

  console.log('Running migrations...');
  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  await migrate(db, {
    migrationsFolder: path.resolve(__dirname, 'migrations'),
  });

  console.log('Migrations complete!');
  await client.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

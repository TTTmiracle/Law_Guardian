import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// DATABASE_URL is loaded by dotenv in src/index.ts before this module is used.
// The lazy getter pattern ensures the connection is only created when first accessed,
// by which point dotenv has already populated process.env.
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _client: ReturnType<typeof postgres> | null = null;

function getClient() {
  if (!_client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set. Check your .env file.');
    _client = postgres(url);
  }
  return _client;
}

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    if (!_db) {
      _db = drizzle(getClient(), { schema });
    }
    return (_db as any)[prop];
  },
});

export * from './schema';

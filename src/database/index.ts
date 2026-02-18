import { drizzle } from 'drizzle-orm/better-sqlite3';
import { databaseUrl } from '../shared/constant/env';
import Database from 'better-sqlite3';
import * as schema from './schema';

const sqlite = new Database(databaseUrl);
const db = drizzle(sqlite, { schema });

export default db
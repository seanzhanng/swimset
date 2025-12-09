import { Pool, QueryResult, QueryResultRow } from 'pg';

/**
 * Central Postgres connection pool.
 *
 * Configuration:
 *  - Prefer DATABASE_URL if set (e.g. for Render/Fly.io/Heroku).
 *  - Otherwise, uses default PG* environment variables:
 *      PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE
 *
 * This file should be the ONLY place where low-level DB details live.
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined
});

/**
 * Small wrapper around pg's query method.
 *
 * T is the shape of a row:
 *   - It must be compatible with QueryResultRow
 *   - e.g. your WorkoutRow interface
 *
 * Usage:
 *   const result = await query<WorkoutRow>('SELECT ...', [params]);
 *   result.rows[0].id // typed
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  // Cast params to any[] because pg expects (text, any[])
  return pool.query<T>(text, params as any[]);
}

export default pool;
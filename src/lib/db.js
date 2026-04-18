import { Pool } from 'pg';

/**
 * DATABASE CONFIGURATION — Singleton Pool
 *
 * In Next.js dev mode, hot reloads re-import modules and would create a
 * new Pool on every change. We use a global singleton to prevent this,
 * keeping a single persistent connection pool across reloads.
 *
 * search_path is set via the 'options' connection parameter — this is
 * handled at the protocol level and requires zero extra SQL queries.
 */

let pool;

if (!global._pgPool) {
  global._pgPool = new Pool({
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT || '5432'),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    // Sets search_path at connection time — no extra query needed
    options: '-c search_path=aeroflow,public',
    // Pool sizing for performance
    max: 10,                          // max concurrent connections
    min: 2,                           // keep 2 connections warm
    idleTimeoutMillis: 30000,         // release idle connections after 30s
    connectionTimeoutMillis: 10000,   // fail fast if server unreachable
  });

  console.log('✅ New PostgreSQL pool created');
}

pool = global._pgPool;

/**
 * Runs a parameterized query using the shared pool.
 * @param {string} text - SQL query string
 * @param {Array}  params - Query parameters
 */
export const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Query OK', { duration: `${duration}ms`, rows: res.rowCount });
    return res;
  } catch (err) {
    console.error('Database query error:', err.message);
    throw err;
  }
};

/**
 * Maps structured PL/pgSQL exception messages to { status, body } objects.
 *
 * Every stored function in db_logic.sql raises EXCEPTION with a prefix:
 *   RAISE EXCEPTION 'VALIDATION_ERROR: Fuel level exceeds capacity.';
 *   RAISE EXCEPTION 'DUPLICATE_ERROR: Airline with ID 5 already exists.';
 *   RAISE EXCEPTION 'NOT_FOUND: Flight with ID 99 does not exist.';
 *   RAISE EXCEPTION 'CONSTRAINT_ERROR: Aircraft is not available.';
 *   RAISE EXCEPTION 'CAPACITY_ERROR: No Economy seats available.';
 *   RAISE EXCEPTION 'BUSINESS_RULE: Cancelled booking cannot be reinstated.';
 *
 * Route handlers call:
 *   const { status, body } = handleDbError(error);
 *   return NextResponse.json(body, { status });
 *
 * @param {Error} err
 * @returns {{ status: number, body: { error: string } }}
 */
export function handleDbError(err) {
  const msg = err.message || '';

  // PostgreSQL constraint violations (raised by DB, not our code)
  if (err.code === '23503') {
    return { status: 409, body: { error: 'Cannot delete: this record is referenced by other records.' } };
  }
  if (err.code === '23505') {
    return { status: 409, body: { error: `Duplicate value constraint: ${msg}` } };
  }

  // Our structured exceptions from stored functions
  if (msg.startsWith('VALIDATION_ERROR:')) {
    return { status: 400, body: { error: msg.replace('VALIDATION_ERROR:', '').trim() } };
  }
  if (msg.startsWith('DUPLICATE_ERROR:')) {
    return { status: 409, body: { error: msg.replace('DUPLICATE_ERROR:', '').trim() } };
  }
  if (msg.startsWith('NOT_FOUND:')) {
    return { status: 404, body: { error: msg.replace('NOT_FOUND:', '').trim() } };
  }
  if (msg.startsWith('CONSTRAINT_ERROR:')) {
    return { status: 400, body: { error: msg.replace('CONSTRAINT_ERROR:', '').trim() } };
  }
  if (msg.startsWith('CAPACITY_ERROR:')) {
    return { status: 409, body: { error: msg.replace('CAPACITY_ERROR:', '').trim() } };
  }
  if (msg.startsWith('BUSINESS_RULE:')) {
    return { status: 422, body: { error: msg.replace('BUSINESS_RULE:', '').trim() } };
  }

  // Fallback for any unhandled DB error
  return { status: 500, body: { error: msg } };
}

export default pool;

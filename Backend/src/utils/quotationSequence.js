// Atomic, cross-instance quotation-number allocator backed by Postgres.
//
// The in-process lock in quotationLock.js only serializes writers within ONE
// Node/Vercel instance. On serverless, separate instances each hold their own
// lock, so two simultaneous saves on different instances could still mint the
// same number. A single Postgres counter row is the authoritative source of
// truth across every instance: `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`
// increments and returns the new value in one atomic statement.
//
// PG* env vars (PGHOST / PGDATABASE / PGUSER / PGPASSWORD / PGSSLMODE) are read
// automatically by node-postgres. If Postgres is unreachable the caller falls
// back to the sheet-based number (instance-local, in-process lock only), so a
// DB outage degrades gracefully instead of blocking saves — but that fallback
// can DUPLICATE across instances during the outage (see the loud warn in the
// caller). Keep these to minimize that window:
//   * Point PGHOST at Neon's POOLED "-pooler" endpoint (PgBouncer, transaction
//     mode). With max:1 below, that avoids exhausting Neon's connection cap as
//     Vercel fans out instances.
//   * Disable Neon scale-to-zero (or accept a one-off cold-resume latency on the
//     first save after idle — connectionTimeoutMillis is sized to ride it out).

const { Pool } = require("pg");

let pool = null;
let tableEnsured = false;

const getPool = () => {
  if (!pool) {
    // Prefer a single DATABASE_URL (point it at Neon's pooled "-pooler"
    // endpoint); otherwise fall back to discrete PG* env vars.
    const connectionString = process.env.DATABASE_URL || undefined;
    // Neon always requires TLS; an explicit ssl object overrides the URL's
    // sslmode and sidesteps cert-verification edge cases on the pooler.
    const useSsl = connectionString
      ? true
      : Boolean(process.env.PGSSLMODE && process.env.PGSSLMODE !== "disable");

    pool = new Pool({
      ...(connectionString ? { connectionString } : {}),
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
      // Each serverless invocation is single-request; one connection is enough,
      // and keeps total connections low across many Vercel instances.
      max: 1,
      // Sized to ride out a Neon scale-to-zero cold resume (often > 5s).
      connectionTimeoutMillis: 12000,
      idleTimeoutMillis: 10000,
    });
    // A dropped idle connection must not crash the process.
    pool.on("error", (err) => {
      console.error("[quotationSequence] idle pg client error:", err.message);
    });
  }
  return pool;
};

const ensureTable = async (client) => {
  if (tableEnsured) {
    return;
  }
  try {
    await client.query(
      `CREATE TABLE IF NOT EXISTS quotation_counter (
         series   TEXT PRIMARY KEY,
         last_seq BIGINT NOT NULL
       )`,
    );
  } catch (err) {
    // 42P07 = duplicate_table: a concurrent cold-start create won the race; the
    // table exists, so proceed rather than failing the allocation.
    if (err.code !== "42P07") {
      throw err;
    }
  }
  tableEnsured = true;
};

const runAllocate = async (series, seedNext) => {
  let client;
  try {
    client = await getPool().connect();
    await ensureTable(client);

    // INSERT seeds the first value (returns seedNext); ON CONFLICT increments.
    // GREATEST keeps the counter from trailing the sheet, so we never re-issue
    // a number the fallback path or an external edit already wrote. One atomic
    // statement -> safe across all instances without any application lock.
    const { rows } = await client.query(
      `INSERT INTO quotation_counter (series, last_seq)
         VALUES ($1, $2)
       ON CONFLICT (series) DO UPDATE
         SET last_seq = GREATEST(quotation_counter.last_seq, $2 - 1) + 1
       RETURNING last_seq`,
      [series, seedNext],
    );
    return Number(rows[0].last_seq);
  } finally {
    if (client) {
      client.release();
    }
  }
};

/**
 * Atomically allocate the next sequence integer for a series.
 *
 * @param {string} series   counter key, e.g. "save" | "response"
 * @param {number} seedNext the number to issue if the counter has never been
 *   initialized, AND (as seedNext - 1) the floor the counter is raised to if it
 *   has fallen behind the sheet — so a number written during a Postgres outage
 *   (fallback path) or an external edit is never re-issued once PG is back.
 * @returns {Promise<number|null>} the allocated integer, or null if Postgres is
 *   unavailable after a retry (caller falls back to the sheet-based number).
 */
const allocateSequence = async (series, seedNext) => {
  if (!Number.isInteger(seedNext)) {
    console.warn(
      `[quotationSequence] non-integer seed (${seedNext}) for "${series}" -> fallback`,
    );
    return null;
  }

  // One bounded retry: a retried allocate can only create a gap (a burned
  // number), never a duplicate, so it is always safe. Neon cold-resume often
  // completes between the two attempts.
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await runAllocate(series, seedNext);
    } catch (err) {
      console.error(
        `[quotationSequence] allocate "${series}" attempt ${attempt}/2 failed: ${err.message}`,
      );
    }
  }
  return null;
};

const isConfigured = () =>
  Boolean(
    process.env.DATABASE_URL ||
      (process.env.PGHOST && process.env.PGDATABASE),
  );

const withTimeout = (promise, ms) =>
  ms > 0
    ? Promise.race([
        promise,
        new Promise((resolve) => setTimeout(() => resolve(null), ms)),
      ])
    : promise;

/**
 * Fast READ of the current counter for a series WITHOUT incrementing — a single
 * indexed-row lookup. Used for the form's "next number" preview so it doesn't
 * scan ~30k sheet cells. Returns the last allocated sequence, or null if the
 * counter is not yet seeded / Postgres is unavailable / the read exceeds
 * timeoutMs (caller then falls back to the sheet scan).
 */
const peekSequence = async (series, { timeoutMs = 0 } = {}) => {
  if (!isConfigured()) {
    return null;
  }

  const run = (async () => {
    let client;
    try {
      client = await getPool().connect();
      const { rows } = await client.query(
        `SELECT last_seq FROM quotation_counter WHERE series = $1`,
        [series],
      );
      return rows.length ? Number(rows[0].last_seq) : null;
    } catch (err) {
      // Table may not exist yet, or PG unreachable -> caller falls back.
      return null;
    } finally {
      if (client) {
        client.release();
      }
    }
  })();

  return withTimeout(run, timeoutMs);
};

/**
 * Health probe for the Postgres counter. Confirms the PG* env vars are set and
 * the DB is reachable, and returns the current counter values. Used by
 * GET /api/quotation/db-health to verify the atomic allocator is live in prod.
 */
const checkHealth = async () => {
  const configured = Boolean(
    process.env.DATABASE_URL ||
      (process.env.PGHOST && process.env.PGDATABASE),
  );
  if (!configured) {
    return {
      ok: false,
      configured: false,
      error:
        "Neither DATABASE_URL nor PG* env vars are set — allocation is using the sheet fallback (no cross-instance guarantee).",
    };
  }

  let client;
  try {
    client = await getPool().connect();
    await ensureTable(client);
    const { rows } = await client.query(
      `SELECT series, last_seq FROM quotation_counter ORDER BY series`,
    );
    const counters = {};
    rows.forEach((row) => {
      counters[row.series] = Number(row.last_seq);
    });
    return { ok: true, configured: true, counters };
  } catch (err) {
    return { ok: false, configured: true, error: err.message };
  } finally {
    if (client) {
      client.release();
    }
  }
};

module.exports = { allocateSequence, checkHealth, peekSequence };

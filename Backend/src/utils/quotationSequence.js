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
    pool = new Pool({
      // Neon and most managed Postgres require TLS. PGSSLMODE=disable opts out.
      ssl:
        process.env.PGSSLMODE && process.env.PGSSLMODE !== "disable"
          ? { rejectUnauthorized: false }
          : undefined,
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

module.exports = { allocateSequence };

// Per-quotation in-process serialization lock.
//
// Concurrent writes to the SAME quotation (two tabs, a retried request, a
// double-submit that slips past the client guard) would otherwise race in the
// controllers' delete-then-append and each append their rows -> every item
// gets written twice. Chaining tasks that share a key serializes them, so the
// second writer's delete sees the first writer's rows and removes them before
// re-inserting. Callers should use the quotation number as the key, and a
// shared constant (e.g. "__new__") for unnumbered writes so number allocation
// and insert can't collide either.
//
// Scope is a single Node process. It fully covers a single server instance;
// on multi-instance/serverless deployments it still removes the dominant
// same-instance race and complements the client-side submit guard.

const locks = new Map();

const withQuotationLock = (key, task) => {
  const run = (locks.get(key) || Promise.resolve()).then(task, task);
  const tail = run.catch(() => {});
  locks.set(key, tail);
  tail.then(() => {
    if (locks.get(key) === tail) {
      locks.delete(key);
    }
  });
  return run;
};

module.exports = { withQuotationLock };

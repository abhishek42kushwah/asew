const db = require("../config/db.config");
const { buildGroupedQuotation } = require("./quotationFormatter");
const {
  SAVE_QUOTATION_MIN_SEQUENCE,
  SAVE_QUOTATION_MAX_SEQUENCE,
  SAVE_QUOTATION_PREFIX,
  RESPONSE_QUOTATION_MIN_SEQUENCE,
  RESPONSE_QUOTATION_PREFIX,
  formatQuotationNumber,
  parseQuotationSequence,
} = require("./quotationNumber");
const { buildItemMasterMap } = require("./quotationPayload");
const { allocateSequence, peekSequence } = require("./quotationSequence");

// Bound the PG preview read so a cold/down DB never hangs the form's spinner.
const PEEK_TIMEOUT_MS = 3000;

const ITEM_MASTER_TTL_MS = 5 * 60 * 1000;
const SHEET_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const sheetCaches = new Map();
const itemMasterCache = {
  loadedAt: 0,
  map: new Map(),
};

const getSheetState = (sheetName) => {
  if (!sheetCaches.has(sheetName)) {
    sheetCaches.set(sheetName, {
      loadedAt: 0,
      byQuotationNo: new Map(),
      order: [],
    });
  }

  return sheetCaches.get(sheetName);
};

const cloneSpan = (span) => ({
  startRow: span.startRow,
  endRow: span.endRow,
});

const buildEntry = ({ sheetName, quotationNo, rows, spans }) => ({
  quotationNo,
  source: sheetName,
  data: buildGroupedQuotation(rows),
  spans: spans.map(cloneSpan),
  startRow: spans[0]?.startRow ?? null,
  endRow: spans[spans.length - 1]?.endRow ?? null,
});

const sortSheetOrder = (state) => {
  state.order.sort((left, right) => {
    const leftEntry = state.byQuotationNo.get(left);
    const rightEntry = state.byQuotationNo.get(right);
    return (leftEntry?.startRow || 0) - (rightEntry?.startRow || 0);
  });
};

const ensureSheetLoaded = async (sheetName, { forceRefresh = false } = {}) => {
  const state = getSheetState(sheetName);
  const now = Date.now();

  if (state.loadedAt && !forceRefresh && (now - state.loadedAt < SHEET_CACHE_TTL_MS)) {
    return state;
  }

  const rowsWithNumbers = await db.getAllWithRowNumbers(sheetName);
  const groupedRows = new Map();

  rowsWithNumbers.forEach(({ rowNumber, data }) => {
    const quotationNo = data.Quotation_No?.toString().trim();

    if (!quotationNo) {
      return;
    }

    if (!groupedRows.has(quotationNo)) {
      groupedRows.set(quotationNo, {
        rows: [],
        spans: [],
      });
    }

    const entry = groupedRows.get(quotationNo);
    entry.rows.push(data);

    const lastSpan = entry.spans[entry.spans.length - 1];
    if (lastSpan && rowNumber === lastSpan.endRow + 1) {
      lastSpan.endRow = rowNumber;
    } else {
      entry.spans.push({
        startRow: rowNumber,
        endRow: rowNumber,
      });
    }
  });

  state.byQuotationNo = new Map();
  state.order = [];

  groupedRows.forEach((value, quotationNo) => {
    const entry = buildEntry({
      sheetName,
      quotationNo,
      rows: value.rows,
      spans: value.spans,
    });

    state.byQuotationNo.set(quotationNo, entry);
    state.order.push(quotationNo);
  });

  sortSheetOrder(state);
  state.loadedAt = Date.now();
  return state;
};

const invalidateSheetCache = (sheetName) => {
  sheetCaches.delete(sheetName);
};

const invalidateItemMasterCache = () => {
  itemMasterCache.loadedAt = 0;
  itemMasterCache.map = new Map();
};

const getQuotationEntry = async (sheetName, quotationNo) => {
  const state = await ensureSheetLoaded(sheetName);
  return state.byQuotationNo.get(quotationNo?.toString().trim()) || null;
};

// Find ONE quotation without loading/grouping the whole sheet: locate its rows
// via the Quotation_No column, then read just that row range.
const findGroupedQuotation = async (sheetName, quotationNo) => {
  const entries = await db.getColumnEntries(sheetName, "Quotation_No");
  const matches = entries.filter((e) => e.value === quotationNo);
  if (!matches.length) {
    return null;
  }
  const startRow = matches[0].rowNumber;
  const endRow = matches[matches.length - 1].rowNumber;
  const rows = await db.getRowRange(sheetName, startRow, endRow);
  const own = rows.filter(
    (r) => (r.Quotation_No || "").toString().trim() === quotationNo,
  );
  return buildGroupedQuotation(own);
};

const lookupQuotation = async (quotationNo) => {
  const normalizedQuotationNo = quotationNo?.toString().trim();
  if (!normalizedQuotationNo) return null;

  const saveData = await findGroupedQuotation("save", normalizedQuotationNo);
  if (saveData) {
    return {
      source: "save",
      data: saveData,
    };
  }

  const responseData = await findGroupedQuotation(
    "response",
    normalizedQuotationNo,
  );
  if (responseData) {
    return {
      source: "response",
      data: responseData,
    };
  }

  return null;
};

const shiftEntriesAfterRow = (state, deletedEndRow, delta) => {
  state.byQuotationNo.forEach((entry) => {
    if (!entry.spans.length) {
      return;
    }

    entry.spans = entry.spans.map((span) =>
      span.startRow > deletedEndRow
        ? {
            startRow: span.startRow + delta,
            endRow: span.endRow + delta,
          }
        : span,
    );

    entry.startRow = entry.spans[0]?.startRow ?? null;
    entry.endRow = entry.spans[entry.spans.length - 1]?.endRow ?? null;
  });
};

const deleteQuotationRows = async (sheetName, quotationNo) => {
  const state = await ensureSheetLoaded(sheetName);
  const normalizedQuotationNo = quotationNo?.toString().trim();
  const entry = state.byQuotationNo.get(normalizedQuotationNo);

  if (!entry) {
    // The in-memory cache has no record of this quotation, but rows may still
    // exist in the sheet (cold/stale cache, multi-worker process, external
    // edit, or a prior failed delete). Skipping deletion here causes the new
    // rows to be appended after the surviving old rows -> item repetition.
    // Fall back to an authoritative scan of the sheet so deletion is never
    // silently skipped.
    const deleted = await db.deleteRowsByColumn(
      sheetName,
      "Quotation_No",
      normalizedQuotationNo,
    );

    if (deleted > 0) {
      invalidateSheetCache(sheetName);
    }

    return { deleted, usedCache: false };
  }

  if (entry.spans.length !== 1) {
    const deleted = await db.deleteRowsByColumn(
      sheetName,
      "Quotation_No",
      normalizedQuotationNo,
    );

    invalidateSheetCache(sheetName);

    return { deleted, usedCache: false };
  }

  const deleted = await db.deleteRowRange(sheetName, entry.startRow, entry.endRow);
  state.byQuotationNo.delete(normalizedQuotationNo);
  state.order = state.order.filter((value) => value !== normalizedQuotationNo);
  shiftEntriesAfterRow(state, entry.endRow, -deleted);
  sortSheetOrder(state);
  state.loadedAt = Date.now();

  return { deleted, usedCache: true };
};

const upsertQuotationEntry = async (
  sheetName,
  quotationNo,
  rows,
  appendMetadata,
) => {
  const state = getSheetState(sheetName);

  // Only patch an already-warm cache. If the cache is cold or expired, skip —
  // loading the entire sheet just to insert one freshly-written entry would put
  // a full ~30k-row read back on the (otherwise fast) save path. The next read
  // loads from the sheet, which already contains these rows.
  const isWarm =
    state.loadedAt && Date.now() - state.loadedAt < SHEET_CACHE_TTL_MS;
  if (!isWarm) {
    return null;
  }

  const normalizedQuotationNo = quotationNo?.toString().trim();
  const spans =
    appendMetadata?.startRow && appendMetadata?.endRow
      ? [
          {
            startRow: appendMetadata.startRow,
            endRow: appendMetadata.endRow,
          },
        ]
      : [];

  const entry = buildEntry({
    sheetName,
    quotationNo: normalizedQuotationNo,
    rows,
    spans,
  });

  state.byQuotationNo.set(normalizedQuotationNo, entry);

  if (!state.order.includes(normalizedQuotationNo)) {
    state.order.push(normalizedQuotationNo);
  }

  sortSheetOrder(state);
  state.loadedAt = Date.now();
  return entry;
};

const getItemMasterMap = async () => {
  const now = Date.now();

  if (
    itemMasterCache.loadedAt &&
    now - itemMasterCache.loadedAt < ITEM_MASTER_TTL_MS
  ) {
    return itemMasterCache.map;
  }

  const rows = await db.getAll("Item_Master");
  itemMasterCache.map = buildItemMasterMap(rows);
  itemMasterCache.loadedAt = now;

  return itemMasterCache.map;
};

// Scan the Quotation_No column of both sheets for the max active QT sequence
// (ignoring out-of-band anomalies like year-like 2009/2010), or 0 if none.
const computeSaveSheetMax = async () => {
  const [saveNos, responseNos] = await Promise.all([
    db.getColumnValues("save", "Quotation_No"),
    db.getColumnValues("response", "Quotation_No"),
  ]);

  let maxSequence = 0;
  [saveNos, responseNos].forEach((quotationNos) => {
    quotationNos.forEach((quotationNo) => {
      // Use the real prefix (not the zero-suffixed one) so seq >= 1000 isn't
      // dropped once the series crosses 999.
      if (!quotationNo || !quotationNo.startsWith(SAVE_QUOTATION_PREFIX)) {
        return;
      }
      const sequence = parseQuotationSequence(
        quotationNo,
        SAVE_QUOTATION_PREFIX,
      );
      if (
        sequence !== null &&
        sequence > maxSequence &&
        sequence <= SAVE_QUOTATION_MAX_SEQUENCE
      ) {
        maxSequence = sequence;
      }
    });
  });
  return maxSequence;
};

const getNextSaveQuotationNumber = async () => {
  // Fast path: the Postgres counter is authoritative — a single indexed-row
  // read (~ms). Keep it cheap; the counter is kept in sync by every save's
  // GREATEST floor, and reconciled if it ever drifts. Only scan the sheet when
  // PG is genuinely unavailable (the seed/fallback case).
  const pgLast = await peekSequence("save", { timeoutMs: PEEK_TIMEOUT_MS });
  if (pgLast !== null) {
    return formatQuotationNumber(SAVE_QUOTATION_PREFIX, pgLast + 1);
  }

  const sheetMax = await computeSaveSheetMax();
  const highest = Math.max(SAVE_QUOTATION_MIN_SEQUENCE, sheetMax);
  return formatQuotationNumber(SAVE_QUOTATION_PREFIX, highest + 1);
};

const getNextResponseQuotationNumber = async () => {
  const pgLast = await peekSequence("response", { timeoutMs: PEEK_TIMEOUT_MS });
  if (pgLast !== null) {
    return formatQuotationNumber(RESPONSE_QUOTATION_PREFIX, pgLast + 1);
  }

  const responseNos = await db.getColumnValues("response", "Quotation_No");
  let maxSequence = RESPONSE_QUOTATION_MIN_SEQUENCE;

  responseNos.forEach((quotationNo) => {
    const sequence = parseQuotationSequence(quotationNo, RESPONSE_QUOTATION_PREFIX);

    if (sequence !== null && sequence > maxSequence) {
      maxSequence = sequence;
    }
  });

  return formatQuotationNumber(RESPONSE_QUOTATION_PREFIX, maxSequence + 1);
};

// Atomically ALLOCATE the next save number (use at save time). Postgres is the
// cross-instance source of truth; the sheet peek seeds it and acts as a floor.
// Falls back to the sheet number if Postgres is unavailable.
// Returns { quotationNo, viaPg }. viaPg=true means the number is globally unique
// (Postgres atomic) and the caller may write in parallel; viaPg=false is the
// sheet fallback (PG down) and the caller must serialize on this instance.
const allocateSaveQuotationNumber = async () => {
  const previewNo = await getNextSaveQuotationNumber();
  const seedNext = parseQuotationSequence(previewNo, SAVE_QUOTATION_PREFIX);
  const sequence = await allocateSequence("save", seedNext);
  if (sequence === null) {
    // Postgres unavailable -> sheet number under the in-process lock only. This
    // can DUPLICATE across instances during a PG outage (and reuse an in-flight
    // number if PG was ahead of the sheet). Loud so a monitor can alert; it
    // self-heals via the GREATEST floor once PG returns.
    console.warn(
      `[quotationCache] SAVE number fallback (Postgres unavailable) -> ${previewNo}; cross-instance uniqueness NOT guaranteed`,
    );
    return { quotationNo: previewNo, viaPg: false };
  }
  return {
    quotationNo: formatQuotationNumber(SAVE_QUOTATION_PREFIX, sequence),
    viaPg: true,
  };
};

const allocateResponseQuotationNumber = async () => {
  const previewNo = await getNextResponseQuotationNumber();
  const seedNext = parseQuotationSequence(previewNo, RESPONSE_QUOTATION_PREFIX);
  const sequence = await allocateSequence("response", seedNext);
  if (sequence === null) {
    console.warn(
      `[quotationCache] RESPONSE number fallback (Postgres unavailable) -> ${previewNo}; cross-instance uniqueness NOT guaranteed`,
    );
    return { quotationNo: previewNo, viaPg: false };
  }
  return {
    quotationNo: formatQuotationNumber(RESPONSE_QUOTATION_PREFIX, sequence),
    viaPg: true,
  };
};

module.exports = {
  allocateResponseQuotationNumber,
  allocateSaveQuotationNumber,
  deleteQuotationRows,
  getItemMasterMap,
  getNextResponseQuotationNumber,
  getNextSaveQuotationNumber,
  getQuotationEntry,
  invalidateItemMasterCache,
  invalidateSheetCache,
  lookupQuotation,
  upsertQuotationEntry,
};

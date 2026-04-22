const db = require("../config/db.config");
const { buildGroupedQuotation } = require("./quotationFormatter");
const {
  SAVE_QUOTATION_MIN_SEQUENCE,
  SAVE_QUOTATION_PREFIX,
  SAVE_QUOTATION_SERIES_PREFIX,
  RESPONSE_QUOTATION_MIN_SEQUENCE,
  RESPONSE_QUOTATION_PREFIX,
  formatQuotationNumber,
  parseQuotationSequence,
} = require("./quotationNumber");
const { buildItemMasterMap } = require("./quotationPayload");

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

const lookupQuotation = async (quotationNo) => {
  const normalizedQuotationNo = quotationNo?.toString().trim();
  if (!normalizedQuotationNo) return null;

  const saveEntry = await getQuotationEntry("save", normalizedQuotationNo);
  if (saveEntry) {
    return {
      source: "save",
      data: saveEntry.data,
    };
  }

  const responseEntry = await getQuotationEntry("response", normalizedQuotationNo);
  if (responseEntry) {
    return {
      source: "response",
      data: responseEntry.data,
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
    return { deleted: 0, usedCache: false };
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
  const state = await ensureSheetLoaded(sheetName);
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

const getNextSaveQuotationNumber = async () => {
  const [saveRows, responseRows] = await Promise.all([
    db.getTail("save", 200),
    db.getTail("response", 200),
  ]);

  let maxSequence = SAVE_QUOTATION_MIN_SEQUENCE;

  [saveRows, responseRows].forEach((rows) => {
    rows.forEach((row) => {
      const quotationNo = row.Quotation_No?.toString().trim();
      if (!quotationNo || !quotationNo.startsWith(SAVE_QUOTATION_SERIES_PREFIX)) {
        return;
      }

      const sequence = parseQuotationSequence(
        quotationNo,
        SAVE_QUOTATION_PREFIX,
      );

      if (sequence !== null && sequence > maxSequence) {
        maxSequence = sequence;
      }
    });
  });

  return formatQuotationNumber(SAVE_QUOTATION_PREFIX, maxSequence + 1);
};

const getNextResponseQuotationNumber = async () => {
  const responseState = await ensureSheetLoaded("response");
  let maxSequence = RESPONSE_QUOTATION_MIN_SEQUENCE;

  responseState.byQuotationNo.forEach((entry) => {
    const sequence = parseQuotationSequence(
      entry.quotationNo,
      RESPONSE_QUOTATION_PREFIX,
    );

    if (sequence !== null && sequence > maxSequence) {
      maxSequence = sequence;
    }
  });

  return formatQuotationNumber(RESPONSE_QUOTATION_PREFIX, maxSequence + 1);
};

module.exports = {
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

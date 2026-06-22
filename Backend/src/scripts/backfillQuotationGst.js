/**
 * One-time backfill: repair per-item GST display fields for existing quotation
 * rows in the `save` and `response` sheets.
 *
 * WHY
 *   `save`/`response` sheets were created WITHOUT the columns Item_GST_Percent,
 *   Item_GST_Amount, Freight_GST_Percent, Packaging_GST_Percent, Total_GST.
 *   db.config.insertMultipleByHeader maps an object to a row by the LIVE header,
 *   so any payload key without a matching column is silently dropped on write.
 *   Result: per-item GST % / GST amount were never persisted. Some older rows
 *   also carry a zero/garbage Total_Price from an earlier save bug.
 *
 * WHAT THIS DOES (per item row, independently)
 *   - Item_GST_Percent: recovered from the stored Total_Price by inverting
 *       taxable = Unit_Price*Qty*(1 - Item_Discount/100)
 *       rate    = (Total_Price/taxable - 1) * 100   (snapped to a GST slab)
 *     This preserves the TRUE historical rate (12/5/18/28...) instead of
 *     assuming one. Falls back to DEFAULT_GST_PERCENT only when Total_Price is
 *     missing/zero/garbage (genuinely broken rows). A value already stored in
 *     Item_GST_Percent is always trusted (idempotent re-runs, post-fix saves).
 *   - Item_GST_Amount = Total_Price - taxable (kept internally consistent).
 *   - Total_Price: written ONLY for broken rows we recompute. Healthy rows keep
 *     their persisted total untouched.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 *   It does not rewrite Subtotal / Total_GST / Total_Amount. The form recomputes
 *   those on load (calculateSubtotal/TotalGST/GrandTotal in QuotationForm.jsx),
 *   so persisting them adds risk (freight/discount default ambiguity) for no
 *   display benefit. The columns are still created so FUTURE saves persist them.
 *
 * SAFETY
 *   - DRY RUN by default. Pass --commit to write.
 *   - Idempotent. Healthy Total_Price never overwritten.
 *   - Header is appended (never reordered/shrunk); WRITE columns are validated
 *     to exist exactly once before any write; write is verified by cell count.
 *   - Legacy JSON-blob rows (ITEMS starts with "[") and rows without a
 *     Quotation_No are skipped and left untouched.
 *
 * AFTER --commit YOU MUST RESTART THE API SERVER.
 *   A long-running server caches the old header (db.config.headerCache) and the
 *   grouped sheet data (quotationCache, 5-min TTL). Without a restart, new saves
 *   keep dropping the GST columns and reads serve stale data for up to 5 min.
 *   (db.config now self-heals the header cache on the next save that carries the
 *   new keys, but a restart is the reliable, immediate fix.)
 *
 * RUN
 *   node src/scripts/backfillQuotationGst.js              # dry run, both sheets
 *   node src/scripts/backfillQuotationGst.js --commit     # write changes
 *   node src/scripts/backfillQuotationGst.js --sheet=save --commit
 */

require("dotenv").config();
const sheets = require("../config/googleSheet");
const db = require("../config/db.config");

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const DEFAULT_GST_PERCENT = 18;
const GST_SLABS = [0, 0.25, 3, 5, 12, 18, 28];

// Columns the sheet must end up having (created if absent). Future saves write
// all of these; this backfill only writes the subset in WRITE_COLUMNS.
const NEW_COLUMNS = [
  "Item_GST_Percent",
  "Item_GST_Amount",
  "Freight_GST_Percent",
  "Packaging_GST_Percent",
  "Total_GST",
];

// Columns this backfill actually writes. Total_Price pre-exists (required);
// the two Item_GST_* are appended by ensureColumns.
const WRITE_COLUMNS = ["Item_GST_Percent", "Item_GST_Amount", "Total_Price"];

const args = process.argv.slice(2);
const COMMIT = args.includes("--commit");
const sheetArg = args.find((a) => a.startsWith("--sheet="));
const TARGET_SHEETS = sheetArg ? [sheetArg.split("=")[1]] : ["save", "response"];

const num = (value) => {
  const n = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
};

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const isLegacyJsonRow = (itemsCell) =>
  typeof itemsCell === "string" && itemsCell.trim().startsWith("[");

// 0-based column index -> A1 column letter (0->A, 26->AA).
const colLetter = (index) => {
  let n = index;
  let letter = "";
  do {
    letter = String.fromCharCode(65 + (n % 26)) + letter;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letter;
};

// Snap a recovered rate to the nearest GST slab when close, else round.
const snapRate = (raw) => {
  if (!Number.isFinite(raw)) return DEFAULT_GST_PERCENT;
  let nearest = null;
  let nd = Infinity;
  for (const slab of GST_SLABS) {
    const d = Math.abs(raw - slab);
    if (d < nd) {
      nd = d;
      nearest = slab;
    }
  }
  if (nd <= 0.75) return nearest; // -0.3 -> 0, 11.4 -> 12, 17.9 -> 18
  if (raw < 0) return DEFAULT_GST_PERCENT; // far-negative => garbage total
  return Math.round(raw);
};

/**
 * Decide the per-item GST for one row.
 * Returns { gstPercent, gstAmount, totalPrice, writeTotal, source }.
 * writeTotal=true means Total_Price should be (re)written (broken rows only).
 */
const computeItem = (obj) => {
  const qty = num(obj.Qty);
  const unitPrice = num(obj.Unit_Price);
  const discount = num(obj.Item_Discount);
  const taxable = unitPrice * qty * (1 - discount / 100);

  const storedPct = String(obj.Item_GST_Percent ?? "").trim();
  const storedTotal = num(obj.Total_Price);

  // PRIORITY 1 — recover the rate from the persisted Total_Price.
  //   Total_Price is the customer-facing quoted line total (the value in the
  //   generated PDF, a real column since day 1), so it is the source of truth.
  //   The new Item_GST_Percent column is corruption-prone (other values have
  //   leaked into it), so we do NOT trust it over a sane total. "Sane" =
  //   storedTotal >= taxable (GST non-negative) and rate <= 100. Total kept.
  if (taxable > 0 && storedTotal >= taxable - 0.01) {
    const rawRate = (storedTotal / taxable - 1) * 100;
    if (rawRate <= 100) {
      const gstPercent = snapRate(rawRate);
      return {
        gstPercent,
        gstAmount: round2(storedTotal - taxable),
        totalPrice: storedTotal,
        writeTotal: false, // healthy total -> leave untouched
        source: Math.abs(rawRate - gstPercent) > 0.5 ? "recovered-snapped" : "recovered",
      };
    }
    // rawRate absurd -> stored total itself corrupt -> fall through.
  }

  // PRIORITY 2 — no usable total. Trust a sane stored % if present; the total
  //   was unusable so recompute and rewrite it.
  if (storedPct !== "") {
    const p = num(storedPct);
    if (p >= 0 && p <= 100) {
      const totalPrice = round2(taxable + (taxable * p) / 100);
      return {
        gstPercent: p,
        gstAmount: round2(totalPrice - taxable),
        totalPrice,
        writeTotal: true,
        source: "from-pct",
      };
    }
  }

  // PRIORITY 3 — nothing usable -> repair at default rate.
  const gstPercent = DEFAULT_GST_PERCENT;
  const totalPrice = round2(taxable + (taxable * gstPercent) / 100);
  return {
    gstPercent,
    gstAmount: round2(totalPrice - taxable),
    totalPrice,
    writeTotal: true,
    source: "defaulted",
  };
};

/**
 * Ensure NEW_COLUMNS exist on the live header, appended after the true last
 * header cell (read raw, untrimmed-length, to avoid clobbering a stray cell).
 * Returns the resulting header array. Writes only under --commit.
 */
const ensureColumns = async (sheetName) => {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!1:1`,
  });
  const rawHeader = (res.data.values?.[0] || []).map((h) => String(h).trim());
  const missing = NEW_COLUMNS.filter((c) => !rawHeader.includes(c));
  const finalHeader = [...rawHeader, ...missing];

  if (missing.length === 0) {
    console.log(`  [headers] ${sheetName}: all columns present`);
    return finalHeader;
  }

  const lastLetter = colLetter(finalHeader.length - 1);
  console.log(
    `  [headers] ${sheetName}: appending ${missing.length} column(s) at A1:${lastLetter}1 -> ${missing.join(", ")}`,
  );

  if (COMMIT) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1:${lastLetter}1`,
      valueInputOption: "RAW",
      requestBody: { values: [finalHeader] },
    });
    await db.getHeaders(sheetName, { forceRefresh: true });
  } else {
    console.log(`  [headers] (dry-run) header would become: ${finalHeader.join(" | ")}`);
  }

  return finalHeader;
};

// Validate a WRITE column exists exactly once; return its index.
const resolveColumn = (headers, col, sheetName) => {
  const i = headers.indexOf(col);
  if (i === -1) {
    throw new Error(`Required column "${col}" missing from ${sheetName} header`);
  }
  if (i !== headers.lastIndexOf(col)) {
    throw new Error(`Column "${col}" appears more than once in ${sheetName} header`);
  }
  return i;
};

const backfillSheet = async (sheetName) => {
  console.log(`\n=== Sheet: ${sheetName} ===`);
  const headers = await ensureColumns(sheetName);

  // Resolve + validate the write targets up front (abort before any write).
  const writeColIdx = {};
  WRITE_COLUMNS.forEach((col) => {
    writeColIdx[col] = resolveColumn(headers, col, sheetName);
  });
  console.log(
    `  [columns] ${WRITE_COLUMNS.map((c) => `${c}->${colLetter(writeColIdx[c])}`).join(", ")}`,
  );

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A2:ZZ`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const rawRows = res.data.values || [];

  if (rawRows.length === 0) {
    console.log("  (no data rows)");
    return { sheet: sheetName, total: 0, changed: 0, skipped: 0, bySource: {} };
  }

  const objs = rawRows.map((row) =>
    headers.reduce((obj, key, i) => {
      obj[key] = row[i] ?? "";
      return obj;
    }, {}),
  );

  const overrides = new Array(objs.length).fill(null);
  const bySource = {};
  const samplesBySource = {};
  let changed = 0;
  let skipped = 0;
  let totalRewrites = 0;

  objs.forEach((obj, idx) => {
    const quotationNo = String(obj.Quotation_No ?? "").trim();
    if (!quotationNo || isLegacyJsonRow(obj.ITEMS)) {
      skipped += 1;
      return;
    }
    const r = computeItem(obj);
    const ov = {
      Item_GST_Percent: r.gstPercent,
      Item_GST_Amount: r.gstAmount,
    };
    if (r.writeTotal) {
      ov.Total_Price = r.totalPrice;
      totalRewrites += 1;
    }
    overrides[idx] = ov;
    bySource[r.source] = (bySource[r.source] || 0) + 1;
    if (!samplesBySource[r.source]) samplesBySource[r.source] = [];
    if (samplesBySource[r.source].length < 3) {
      samplesBySource[r.source].push({ idx, ov });
    }
    changed += 1;
  });

  // Build one range per WRITE column. Rows we don't touch pass their existing
  // cell value straight through (identical for Total_Price on healthy rows).
  const lastRow = rawRows.length + 1;
  const data = WRITE_COLUMNS.map((col) => {
    const idx = writeColIdx[col];
    const letter = colLetter(idx);
    const values = rawRows.map((row, i) => {
      const ov = overrides[i];
      if (ov && col in ov) return [ov[col]];
      return [row[idx] ?? ""];
    });
    return { range: `${sheetName}!${letter}2:${letter}${lastRow}`, values };
  });

  // Sample for eyeballing — a few examples from EACH source bucket so the
  // common case (recovered, total kept) is visible, not just broken outliers.
  Object.keys(samplesBySource).forEach((src) => {
    console.log(`  -- ${src} --`);
    samplesBySource[src].forEach(({ idx: i, ov }) => {
      const o = objs[i];
      console.log(
        `     row ${i + 2} [${o.Quotation_No}] qty=${o.Qty} unit=${o.Unit_Price} ` +
          `storedTotal=${o.Total_Price} -> gst%=${ov.Item_GST_Percent} ` +
          `gstAmt=${ov.Item_GST_Amount}${"Total_Price" in ov ? ` total=${ov.Total_Price} (REWRITE)` : " (total kept)"}`,
      );
    });
  });

  console.log(
    `  sources: ${Object.entries(bySource).map(([k, v]) => `${k}=${v}`).join(", ") || "none"} | total rewrites: ${totalRewrites}`,
  );

  if (COMMIT) {
    const resp = await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { valueInputOption: "USER_ENTERED", data },
    });
    // Detect a partial apply: every column range must come back with a response.
    // (Cell counts are unreliable here — writing "" to an already-empty skipped
    // row is a no-op Sheets may not tally.)
    const applied = resp.data.responses?.length ?? 0;
    if (applied !== data.length) {
      throw new Error(
        `Write verification failed for "${sheetName}": expected ${data.length} column ranges applied, got ${applied}. Inspect the sheet before re-running.`,
      );
    }
    console.log(
      `  [write] OK — ${data.length} column(s) applied, ${resp.data.totalUpdatedCells ?? "?"} cells touched`,
    );
  } else {
    console.log(`  [dry-run] would update ${changed} row(s)`);
  }

  return { sheet: sheetName, total: rawRows.length, changed, skipped, bySource };
};

(async () => {
  if (!SPREADSHEET_ID) {
    console.error("SPREADSHEET_ID missing from env. Aborting.");
    process.exit(1);
  }

  console.log(
    `Backfill GST — mode: ${COMMIT ? "COMMIT (writing)" : "DRY RUN (no writes)"} ` +
      `| sheets: ${TARGET_SHEETS.join(", ")} | default GST%: ${DEFAULT_GST_PERCENT}`,
  );

  const summaries = [];
  let hadError = false;
  for (const sheetName of TARGET_SHEETS) {
    try {
      summaries.push(await backfillSheet(sheetName));
    } catch (err) {
      hadError = true;
      console.error(`Failed on sheet "${sheetName}":`, err.message);
      summaries.push({ sheet: sheetName, error: err.message });
    }
  }

  console.log("\n=== Summary ===");
  summaries.forEach((s) =>
    s.error
      ? console.log(`  ${s.sheet}: ERROR ${s.error}`)
      : console.log(
          `  ${s.sheet}: ${s.total} rows, ${s.changed} recomputed, ${s.skipped} skipped`,
        ),
  );
  if (!COMMIT) {
    console.log("\nDry run only. Re-run with --commit to persist changes.");
  } else {
    console.log("\nDone. RESTART THE API SERVER now so new columns are picked up.");
  }
  process.exit(hadError ? 1 : 0);
})();

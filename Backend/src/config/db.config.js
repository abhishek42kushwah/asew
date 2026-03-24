require("dotenv").config();
const sheets = require("./googleSheet");

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

/**
 * Normalize helper
 */
const normalize = (s) =>
  s?.toString().trim().replace(/\s+/g, " ").toLowerCase();

/**
 * ✅ INSERT BY HEADER NAME
 */
const insertByHeader = async (sheetName, dataObject) => {
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!1:1`,
  });

  const rawHeaders = headerRes.data.values[0].map((h) => h.trim());
  
  const row = rawHeaders.map((header) => dataObject[header] ?? "");
  
  // Explicitly find the next row instead of relying on append
  const allRowsRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:A`,
  });
  const nextRow = (allRowsRes.data.values ? allRowsRes.data.values.length : 0) + 1;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A${nextRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });
};

/**
 * ✅ INSERT MULTIPLE BY HEADER NAME
 */
const insertMultipleByHeader = async (sheetName, dataObjects) => {
  if (!dataObjects || dataObjects.length === 0) return;

  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!1:1`,
  });

  const rawHeaders = headerRes.data.values[0].map((h) => h.trim());

  const rows = dataObjects.map((dataObject) => {
    return rawHeaders.map((header) => dataObject[header] ?? "");
  });

  // Explicitly find the next row instead of relying on append
  const allRowsRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:A`,
  });
  const nextRow = (allRowsRes.data.values ? allRowsRes.data.values.length : 0) + 1;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A${nextRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows },
  });
};

/**
 * GET ALL ROWS
 */
const getAll = async (sheetName) => {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:ZZ`,
  });

  const [headers, ...rows] = res.data.values || [];

  return rows.map((row) =>
    headers.reduce((obj, key, i) => {
      obj[key] = row[i] !== undefined && row[i] !== null ? row[i].toString().trim() : null;
      return obj;
    }, {}),
  );
};

/**
 * WHERE column = value
 */
const find = async (sheetName, column, value) => {
  const rows = await getAll(sheetName);
  return rows.filter((row) => row[column] == value);
};

const findById = async (sheetName, id) => {
  const rows = await getAll(sheetName);
  return rows.find((r) => String(r.User_Id) === String(id));
};

const clearSheet = async (sheetName) => {
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A2:ZZ`,
  });

  return true;
};

/**
 * ✅ UPDATE BY ID (Column A)
 */
const updateById = async (sheetName, id, updatedData, idColumn = null) => {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:ZZ`,
  });

  const rows = res.data.values;
  if (!rows || rows.length === 0) throw new Error("Sheet empty");

  const rawHeaders = rows[0];
  let searchColIndex = 0;

  // If idColumn specified, find its index in headers (robust match)
  const norm = (s) =>
    s
      ?.toString()
      .toLowerCase()
      .replace(/[\s_-]/g, "") || "";

  if (idColumn) {
    const normalizedIdCol = norm(idColumn);
    searchColIndex = rawHeaders.findIndex((h) => norm(h) === normalizedIdCol);
    if (searchColIndex === -1) {
      console.warn(
        `[db] idColumn "${idColumn}" not found in headers, falling back to Column A`,
      );
      searchColIndex = 0;
    }
  }

  // ✅ Find row index where searchColIndex column = id
  const targetId = String(id).trim();
  const rowIndex = rows.findIndex(
    (r, i) =>
      i !== 0 &&
      r[searchColIndex] &&
      String(r[searchColIndex]).trim() === targetId,
  );

  if (rowIndex === -1) {
    console.error(
      `[db] Row not found for id: "${id}" in column index ${searchColIndex}`,
    );
    throw new Error(`Row with ID "${id}" not found in sheet "${sheetName}".`);
  }

  // ✅ Build updated row correctly
  const updatedRow = rawHeaders.map((header, colIndex) => {
    return updatedData[header] !== undefined
      ? updatedData[header]
      : rows[rowIndex][colIndex] || "";
  });

  // ✅ Update Google Sheet row
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A${rowIndex + 1}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [updatedRow],
    },
  });

  return true;
};

/**
 * ✅ BULK UPDATE BY COLUMN — single read + single batchUpdate
 * items: array of { matchValue, data } where matchValue is the value to match in matchColumn
 */
const bulkUpdateByColumn = async (sheetName, matchColumn, items) => {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:ZZ`,
  });

  const rows = res.data.values;
  if (!rows || rows.length === 0) throw new Error("Sheet empty");

  const rawHeaders = rows[0];

  // Find column index for matching
  const norm = (s) => s?.toString().toLowerCase().replace(/[\s_-]/g, "") || "";
  const normalizedMatchCol = norm(matchColumn);
  let matchColIndex = rawHeaders.findIndex((h) => norm(h) === normalizedMatchCol);
  if (matchColIndex === -1) matchColIndex = 0;

  // Build lookup of items to update
  const updateMap = new Map();
  items.forEach((item) => {
    updateMap.set(String(item.matchValue).trim(), item.data);
  });

  // Find all matching rows and build batch data
  const batchData = [];
  for (let i = 1; i < rows.length; i++) {
    const cellValue = String(rows[i][matchColIndex] || "").trim();
    if (updateMap.has(cellValue)) {
      const updatedData = updateMap.get(cellValue);
      const updatedRow = rawHeaders.map((header, colIndex) => {
        return updatedData[header] !== undefined
          ? updatedData[header]
          : rows[i][colIndex] || "";
      });
      batchData.push({
        range: `${sheetName}!A${i + 1}`,
        values: [updatedRow],
      });
    }
  }

  if (batchData.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: batchData,
      },
    });
  }

  return { updated: batchData.length, total: items.length };
};

/**
 * ✅ DELETE ROWS BY COLUMN
 */
const deleteRowsByColumn = async (sheetName, columnName, value) => {
  const spreadsheetRes = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });

  const sheet = spreadsheetRes.data.sheets.find(
    (s) => s.properties.title.toLowerCase().trim() === sheetName.toLowerCase().trim(),
  );
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found`);

  const sheetId = sheet.properties.sheetId;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:ZZ`,
  });

  const rows = res.data.values;
  if (!rows || rows.length === 0) return 0;

  const rawHeaders = rows[0];
  const norm = (s) => s?.toString().toLowerCase().replace(/[\s_-]/g, "") || "";
  const normalizedMatchCol = norm(columnName);
  let matchColIndex = rawHeaders.findIndex(
    (h) => norm(h) === normalizedMatchCol,
  );
  if (matchColIndex === -1) matchColIndex = 0;

  const targetValue = String(value).trim();
  const indicesToDelete = [];

  for (let i = 1; i < rows.length; i++) {
    const cellValue = String(rows[i][matchColIndex] || "").trim();
    if (cellValue === targetValue) {
      indicesToDelete.push(i); // 0-based index
    }
  }

  if (indicesToDelete.length === 0) return 0;

  // IMPORTANT: Delete in reverse order to keep indices valid
  const requests = indicesToDelete
    .sort((a, b) => b - a)
    .map((index) => ({
      deleteDimension: {
        range: {
          sheetId: sheetId,
          dimension: "ROWS",
          startIndex: index,
          endIndex: index + 1,
        },
      },
    }));

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: requests,
    },
  });

  return indicesToDelete.length;
};

module.exports = {
  insertByHeader,
  getAll,
  find,
  updateById,
  findById,
  clearSheet,
  insertMultipleByHeader,
  bulkUpdateByColumn,
  deleteRowsByColumn,
};

require("dotenv").config();
const sheets = require("./googleSheet");

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const headerCache = new Map();
const sheetMetadataCache = new Map();

const normalize = (s) =>
  s?.toString().trim().replace(/\s+/g, " ").toLowerCase();

const normalizeHeader = (s) =>
  s?.toString().toLowerCase().replace(/[\s_-]/g, "") || "";

const mapRows = (headers, rows = []) =>
  rows.map((row) =>
    headers.reduce((obj, key, i) => {
      obj[key] =
        row[i] !== undefined && row[i] !== null ? row[i].toString().trim() : null;
      return obj;
    }, {}),
  );

const parseUpdatedRange = (updatedRange) => {
  const match = updatedRange?.match(/![A-Z]+(\d+)(?::[A-Z]+(\d+))?$/i);

  if (!match) {
    return {
      updatedRange,
      startRow: null,
      endRow: null,
      updatedRows: 0,
    };
  }

  const startRow = parseInt(match[1], 10);
  const endRow = parseInt(match[2] || match[1], 10);

  return {
    updatedRange,
    startRow,
    endRow,
    updatedRows: endRow - startRow + 1,
  };
};

const getHeaders = async (sheetName, { forceRefresh = false } = {}) => {
  if (!forceRefresh && headerCache.has(sheetName)) {
    return headerCache.get(sheetName);
  }

  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!1:1`,
  });

  const headers = (headerRes.data.values?.[0] || []).map((header) =>
    header.toString().trim(),
  );

  headerCache.set(sheetName, headers);
  return headers;
};

const getSheetMetadata = async (sheetName, { forceRefresh = false } = {}) => {
  if (!forceRefresh && sheetMetadataCache.has(sheetName)) {
    return sheetMetadataCache.get(sheetName);
  }

  const spreadsheetRes = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });

  const sheet = spreadsheetRes.data.sheets.find(
    (candidate) =>
      candidate.properties.title.toLowerCase().trim() ===
      sheetName.toLowerCase().trim(),
  );

  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found`);
  }

  const metadata = {
    sheetId: sheet.properties.sheetId,
    title: sheet.properties.title,
  };

  sheetMetadataCache.set(sheetName, metadata);
  return metadata;
};

const insertByHeader = async (sheetName, dataObject) => {
  const rawHeaders = await getHeaders(sheetName);
  const row = rawHeaders.map((header) => dataObject[header] ?? "");

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:ZZ`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });

  return parseUpdatedRange(response.data.updates?.updatedRange);
};

const insertMultipleByHeader = async (sheetName, dataObjects) => {
  if (!dataObjects || dataObjects.length === 0) {
    return {
      updatedRange: null,
      startRow: null,
      endRow: null,
      updatedRows: 0,
    };
  }

  const rawHeaders = await getHeaders(sheetName);
  const rows = dataObjects.map((dataObject) =>
    rawHeaders.map((header) => dataObject[header] ?? ""),
  );

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:ZZ`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows },
  });

  return parseUpdatedRange(response.data.updates?.updatedRange);
};

const getAll = async (sheetName) => {
  const headers = await getHeaders(sheetName);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A2:ZZ`,
  });

  return mapRows(headers, res.data.values || []);
};

const getAllWithRowNumbers = async (sheetName) => {
  const headers = await getHeaders(sheetName);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A2:ZZ`,
  });

  return (res.data.values || []).map((row, index) => ({
    rowNumber: index + 2,
    data: headers.reduce((obj, key, cellIndex) => {
      obj[key] =
        row[cellIndex] !== undefined && row[cellIndex] !== null
          ? row[cellIndex].toString().trim()
          : null;
      return obj;
    }, {}),
  }));
};

const getTail = async (sheetName, count = 100) => {
  const allRowsRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:A`,
  });

  const totalRows = allRowsRes.data.values ? allRowsRes.data.values.length : 0;
  if (totalRows <= 1) return [];

  const startRow = Math.max(2, totalRows - count + 1);
  const endRow = totalRows;
  const headers = await getHeaders(sheetName);
  const dataRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A${startRow}:ZZ${endRow}`,
  });

  return mapRows(headers, dataRes.data.values || []);
};

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

const updateById = async (sheetName, id, updatedData, idColumn = null) => {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:ZZ`,
  });

  const rows = res.data.values;
  if (!rows || rows.length === 0) throw new Error("Sheet empty");

  const rawHeaders = rows[0];
  let searchColIndex = 0;

  if (idColumn) {
    const normalizedIdCol = normalizeHeader(idColumn);
    searchColIndex = rawHeaders.findIndex(
      (header) => normalizeHeader(header) === normalizedIdCol,
    );

    if (searchColIndex === -1) {
      console.warn(
        `[db] idColumn "${idColumn}" not found in headers, falling back to Column A`,
      );
      searchColIndex = 0;
    }
  }

  const targetId = String(id).trim();
  const rowIndex = rows.findIndex(
    (row, index) =>
      index !== 0 &&
      row[searchColIndex] &&
      String(row[searchColIndex]).trim() === targetId,
  );

  if (rowIndex === -1) {
    throw new Error(`Row with ID "${id}" not found in sheet "${sheetName}".`);
  }

  const updatedRow = rawHeaders.map((header, colIndex) =>
    updatedData[header] !== undefined ? updatedData[header] : rows[rowIndex][colIndex] || "",
  );

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

const bulkUpdateByColumn = async (sheetName, matchColumn, items) => {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:ZZ`,
  });

  const rows = res.data.values;
  if (!rows || rows.length === 0) throw new Error("Sheet empty");

  const rawHeaders = rows[0];
  const normalizedMatchCol = normalizeHeader(matchColumn);
  let matchColIndex = rawHeaders.findIndex(
    (header) => normalizeHeader(header) === normalizedMatchCol,
  );

  if (matchColIndex === -1) matchColIndex = 0;

  const updateMap = new Map();
  items.forEach((item) => {
    updateMap.set(String(item.matchValue).trim(), item.data);
  });

  const batchData = [];
  for (let i = 1; i < rows.length; i++) {
    const cellValue = String(rows[i][matchColIndex] || "").trim();
    if (updateMap.has(cellValue)) {
      const updatedData = updateMap.get(cellValue);
      const updatedRow = rawHeaders.map((header, colIndex) =>
        updatedData[header] !== undefined ? updatedData[header] : rows[i][colIndex] || "",
      );

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

const deleteRowRange = async (sheetName, startRow, endRow = startRow) => {
  if (!startRow || !endRow || endRow < startRow) {
    return 0;
  }

  const metadata = await getSheetMetadata(sheetName);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: metadata.sheetId,
              dimension: "ROWS",
              startIndex: startRow - 1,
              endIndex: endRow,
            },
          },
        },
      ],
    },
  });

  return endRow - startRow + 1;
};

const deleteRowsByColumn = async (sheetName, columnName, value) => {
  const metadata = await getSheetMetadata(sheetName);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:ZZ`,
  });

  const rows = res.data.values;
  if (!rows || rows.length === 0) return 0;

  const rawHeaders = rows[0];
  const normalizedMatchCol = normalizeHeader(columnName);
  let matchColIndex = rawHeaders.findIndex(
    (header) => normalizeHeader(header) === normalizedMatchCol,
  );

  if (matchColIndex === -1) matchColIndex = 0;

  const targetValue = String(value).trim();
  const indicesToDelete = [];

  for (let i = 1; i < rows.length; i++) {
    const cellValue = String(rows[i][matchColIndex] || "").trim();
    if (cellValue === targetValue) {
      indicesToDelete.push(i);
    }
  }

  if (indicesToDelete.length === 0) return 0;

  const areContiguous = indicesToDelete.every(
    (rowIndex, index) => index === 0 || rowIndex === indicesToDelete[index - 1] + 1,
  );

  if (areContiguous) {
    return deleteRowRange(
      sheetName,
      indicesToDelete[0] + 1,
      indicesToDelete[indicesToDelete.length - 1] + 1,
    );
  }

  const requests = indicesToDelete
    .sort((a, b) => b - a)
    .map((index) => ({
      deleteDimension: {
        range: {
          sheetId: metadata.sheetId,
          dimension: "ROWS",
          startIndex: index,
          endIndex: index + 1,
        },
      },
    }));

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests,
    },
  });

  return indicesToDelete.length;
};

module.exports = {
  bulkUpdateByColumn,
  clearSheet,
  deleteRowRange,
  deleteRowsByColumn,
  find,
  findById,
  getAll,
  getAllWithRowNumbers,
  getHeaders,
  getTail,
  insertByHeader,
  insertMultipleByHeader,
  normalize,
  updateById,
};

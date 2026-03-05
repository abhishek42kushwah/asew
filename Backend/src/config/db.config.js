const sheets = require("./googleSheet");
require("dotenv").config();

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

  const rawHeaders = headerRes.data.values[0];

  const row = rawHeaders.map((header) => dataObject[header] ?? "");

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:ZZ`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
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
      obj[key] = row[i] ?? null;
      return obj;
    }, {})
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
const updateById = async (sheetName, id, updatedData) => {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
  });

  const rows = res.data.values;
  if (!rows || rows.length === 0) throw new Error("Sheet empty");

  const rawHeaders = rows[0];

  // ✅ Find row index where first column = id
  const rowIndex = rows.findIndex((r, i) => i !== 0 && String(r[0]).trim() === String(id).trim());

  if (rowIndex === -1) throw new Error("Row not found");

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


module.exports = {
  insertByHeader,
  getAll,
  find,
  updateById,
  findById,
  clearSheet
};

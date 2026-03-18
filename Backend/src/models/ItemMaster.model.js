const sheets = require("../config/googleSheet");
require("dotenv").config();

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

const createItemMasterSheet = async () => {

  const headers = [[
    "ITEM_NAME",
    "SPECIFICATIONS",
    "UNIT_PRICE",
    "GSTIN_UIN",
    "ITEM_CODE",
    "STOCK",
    "FREQ",
    "AVERAGE",
    "QTY",
    "HSN_CODE",
    "MAKE",
    "STOCK_HOLD",
    "NABL"
  ]];

  try {
    // Create sheet if not exists
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: "Item_Master",
              },
            },
          },
        ],
      },
    });
  } catch (err) {
    console.log("Sheet may already exist");
  }

  // Add header row
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "Item_Master!A1",
    valueInputOption: "RAW",
    requestBody: {
      values: headers,
    },
  });

  console.log("✅ Item_Master sheet created successfully");
};

module.exports = {
  createItemMasterSheet,
};
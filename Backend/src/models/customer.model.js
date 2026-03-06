const sheets = require("../config/googleSheet");
require("dotenv").config();

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

const createCustomerSheet = async () => {
  const headers = [
    [
      "Date",
      "Customer_Name",
      "Buyer_Address",
      "GSTIN_UIN",
      "PAN_No",
      "Contact_Person",
      "Email_Address",
      "Contact_Mobile",
      "Created_at",
      "Updated_at",
    ],
  ];

  try {
    // Create sheet
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: "Customer_Master",
              },
            },
          },
        ],
      },
    });
  } catch (err) {
    console.log("Customer_Master sheet may already exist");
  }

  // Insert header row
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "Customer_Master!A1",
    valueInputOption: "RAW",
    requestBody: {
      values: headers,
    },
  });

  console.log("✅ Customer_Master sheet created successfully");
};

module.exports = {
  createCustomerSheet,
};

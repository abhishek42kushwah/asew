const sheets = require("../config/googleSheet");
require("dotenv").config();

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

const createSaveSheet = async () => {
  const headers = [
    [
      "Date",
      "Quotation_No",
      "Customer_Name",
      "Buyer_Address",
      "GSTIN_UIN",
      "PAN_No",
      "Contact_Person",
      "Contact_Mobile",
      "Email_Address",
      "SPECIFICATIONS",
      "Qty",
      "Unit_Price",
      "Total_Price",
      "Subtotal",
      "Image_URL",
      "Discount",
      "GST",
      "Freight_Charges",
      "Packaging_Charges",
      "Total_Amount",
      "Generated_PDF",
      "ITEMS",
      "Freight_Note",
      "Packaging_Note",
      "Term_Tax",
      "Term_Delivery",
      "Term_Warranty",
      "Delivery_Address",
      "HSN_Code",
      "Make",
      "Item_Discount",
      "Term_Payment",
      "NABL",
    ],
  ];

  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: "save",
              },
            },
          },
        ],
      },
    });
  } catch (err) {
    console.log("Save sheet may already exist");
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "save!A1",
    valueInputOption: "RAW",
    requestBody: {
      values: headers,
    },
  });

  console.log("✅ Save sheet created");
};

module.exports = {
  createSaveSheet,
};

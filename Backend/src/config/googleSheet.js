const { google } = require("googleapis");
const path = require("path");
const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_JSON);
const auth = new google.auth.GoogleAuth({
   credentials: serviceAccount,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({
  version: "v4",
  auth,
});

module.exports = sheets;

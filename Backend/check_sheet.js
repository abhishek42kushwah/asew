const db = require("./src/config/db.config");
require("dotenv").config();

async function checkSheet() {
  try {
    const sheetName = "Item_Master";
    const res = await db.getAll(sheetName);
    if (res.length > 0) {
      console.log("Headers found:", Object.keys(res[0]));
      console.log("First row example:", res[0]);
    } else {
      console.log("Sheet is empty or not found.");
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

checkSheet();

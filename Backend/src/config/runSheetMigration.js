
const { createItemMasterSheet } = require("../models/ItemMaster.model");
const { createCustomerSheet } = require("../models/customer.model");
const { createSaveSheet } = require("../models/save.model");


createSaveSheet()
  .then(() => console.log("Save migration done"))
  .catch(console.error);

createCustomerSheet()
  .then(() => console.log("Customer migration done"))
  .catch(console.error);

createItemMasterSheet()
  .then(() => console.log("Item Master migration done"))
  .catch(console.error);
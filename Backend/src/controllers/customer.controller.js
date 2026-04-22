const db = require("../config/db.config");

const SHEET_NAME = "Customer_Master";

// --- CACHE SETUP ---
let cachedCustomers = null;
let lastCustomersFetch = 0;
const CUSTOMERS_TTL_MS = 5 * 60 * 1000; // 5 minutes

const clearCustomersCache = () => {
  cachedCustomers = null;
  lastCustomersFetch = 0;
};
// -------------------

/**
 * CREATE CUSTOMER
 */
exports.createCustomer = async (req, res) => {
  try {
    const {
      Customer_Name,
      Buyer_Address,
      GSTIN_UIN,
      PAN_No,
      Contact_Person,
      Email_Address,
      Contact_Mobile,
      Delivery_Address,
    } = req.body;

    await db.insertByHeader(SHEET_NAME, {
      Date: new Date().toLocaleDateString(),
      Customer_Name,
      Buyer_Address,
      GSTIN_UIN,
      PAN_No,
      Contact_Person,
      Email_Address,
      Contact_Mobile,
      Delivery_Address,
    });

    clearCustomersCache();

    res.status(201).json({
      message: "Customer created successfully",
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "Error creating customer",
    });
  }
};

/**
 * GET ALL CUSTOMERS
 */
exports.getCustomers = async (req, res) => {
  try {
    const { name } = req.query;
    const now = Date.now();

    let allCustomers = cachedCustomers;
    if (!allCustomers || (now - lastCustomersFetch >= CUSTOMERS_TTL_MS)) {
      allCustomers = await db.getAll(SHEET_NAME);
      cachedCustomers = allCustomers;
      lastCustomersFetch = now;
    }

    if (name) {
      // Search by name
      const customers = allCustomers.filter((row) => row.Customer_Name == name);
      return res.json(customers);
    }

    res.json(allCustomers);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "Error fetching customers",
    });
  }
};
/**
 * UPDATE CUSTOMER
 */
exports.updateCustomer = async (req, res) => {
  try {
    const updateData = req.body;
    const name = updateData.Customer_Name;

    if (!name) {
      return res
        .status(400)
        .json({ message: "Customer_Name is required for update" });
    }

    await db.updateById(
      SHEET_NAME,
      name,
      {
        ...updateData,
      },
      "Customer_Name",
    );

    clearCustomersCache();

    res.json({
      message: "Customer updated successfully",
    });
  } catch (err) {
    console.error(`[CustomerMaster] Update failed: ${err.message}`);
    res.status(500).json({
      message: err.message || "Error updating customer",
    });
  }
};

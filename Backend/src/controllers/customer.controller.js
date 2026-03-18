const db = require("../config/db.config");

const SHEET_NAME = "Customer_Master";

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

    let customers;

    if (name) {
      // Search by name
      customers = await db.find(SHEET_NAME, "Customer_Name", name);
    } else {
      // Get all customers
      customers = await db.getAll(SHEET_NAME);
    }

    res.json(customers);
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

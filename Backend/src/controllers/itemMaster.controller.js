const db = require("../config/db.config");

const SHEET_NAME = "Item_Master";

exports.createItem = async (req, res) => {
  try {
    const {
      ITEM_NAME,
      SPECIFICATIONS,
      UNIT_PRICE,
      GSTIN_UIN,
      STOCK,
      FREQ,
      AVERAGE,
      QTY,
      HSN_CODE,
      STOCK_HOLD,
      NABL,
    } = req.body;

    // Get all items
    const items = await db.getAll(SHEET_NAME);

    // Auto generate ITEM CODE
    const itemCode = `ASEW-${String(items.length + 1).padStart(3, "0")}`;

    await db.insertByHeader(SHEET_NAME, {
      ITEM_NAME,
      SPECIFICATIONS,
      UNIT_PRICE,
      GSTIN_UIN: "18%",
      ITEM_CODE: itemCode,
      STOCK: STOCK || 0,
      FREQ: FREQ || "D",
      AVERAGE: AVERAGE || 0,
      QTY: QTY || 0,
      HSN_CODE: HSN_CODE || "",
      MAKE: "ASEW",
      STOCK_HOLD: STOCK_HOLD || 1,
      NABL: NABL || "",
      CREATED_AT: new Date().toISOString(),
      UPDATED_AT: new Date().toISOString(),
    });

    res.status(201).json({
      message: "Item created successfully",
      item_code: itemCode,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Error creating item",
    });
  }
};

exports.getItems = async (req, res) => {
  try {
    const items = await db.getAll(SHEET_NAME);

    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Error fetching items",
    });
  }
};

exports.updateItem = async (req, res) => {
  try {
    const updateData = req.body;
    const name = updateData.ITEM_NAME;

    if (!name) {
      return res
        .status(400)
        .json({ message: "ITEM_NAME is required for update" });
    }

    // Role-based sync logic (silent)
    await db.updateById(
      SHEET_NAME,
      name,
      {
        ...updateData,
        UPDATED_AT: new Date().toISOString(),
      },
      "ITEM_NAME",
    );

    res.json({
      message: "Item updated successfully",
    });
  } catch (err) {
    console.error(`[ItemMaster] Update failed: ${err.message}`);
    res.status(500).json({
      message: err.message || "Error updating item",
    });
  }
};

const db = require("../config/db.config");
const { uploadToDrive } = require("../utils/googleDrive");

const SHEET_NAME = "save";

/**
 * CREATE SAVE (Quotation)
 */

exports.createSave = async (req, res) => {
  try {

    const data = req.body;

    let Image_URL = [];
    let Generated_PDF = [];

    // Upload Images
    if (req.files?.Image_URL) {
      Image_URL = await Promise.all(
        req.files.Image_URL.map((file) =>
          uploadToDrive(file.buffer, file.originalname, file.mimetype)
        )
      );
    }

    // Upload PDF
    if (req.files?.Generated_PDF) {
      Generated_PDF = await Promise.all(
        req.files.Generated_PDF.map((file) =>
          uploadToDrive(file.buffer, file.originalname, file.mimetype)
        )
      );
    }

    // Generate quotation number
    const allRows = await db.getAll(SHEET_NAME);

    const uniqueNumbers = [
      ...new Set(allRows.map((r) => r.Quotation_No))
    ];

    const nextNumber = uniqueNumbers.length + 1;

    const quotationNo =
      `2025-26/QT/${String(nextNumber).padStart(4, "0")}`;

    // Items
    const items = Array.isArray(data.ITEMS)
      ? data.ITEMS
      : JSON.parse(data.ITEMS || "[]");

    const insertedRows = [];   // ⭐ collect results

    for (const item of items) {

      // Auto fetch item master
      const itemData = await db.find(
        "Item_Master",
        "ITEM_NAME",
        item.item_name
      );

      const master = itemData[0] || {};

      const unitPrice = item.unit_price || master.UNIT_PRICE || 0;

      const hsn = master.HSN_CODE || item.hsn_code || "";

      const make = master.MAKE || item.make || "";

      const totalPrice = unitPrice * item.qty;

      const rowData = {

        Date: data.Date,
        Quotation_No: quotationNo,
        Customer_Name: data.Customer_Name,
        Buyer_Address: data.Buyer_Address,
        GSTIN_UIN: data.GSTIN_UIN,
        PAN_No: data.PAN_No,
        Contact_Person: data.Contact_Person,
        Contact_Mobile: data.Contact_Mobile,
        Email_Address: data.Email_Address,

        Item_Name: item.item_name,
        SPECIFICATIONS: item.specifications,
        Qty: item.qty,
        Unit_Price: unitPrice,
        Total_Price: totalPrice,

        Subtotal: data.Subtotal,

        Image_URL: JSON.stringify(Image_URL),

        Discount: data.Discount,
        GST: data.GST,
        Freight_Charges: data.Freight_Charges,
        Packaging_Charges: data.Packaging_Charges,
        Total_Amount: data.Total_Amount,

        Generated_PDF: JSON.stringify(Generated_PDF),

        ITEMS: JSON.stringify(items),

        Freight_Note: data.Freight_Note,
        Packaging_Note: data.Packaging_Note,

        Term_Tax: data.Term_Tax || "Extra, GST @ 18%",

        Term_Delivery:
          data.Term_Delivery ||
          "1-2 weeks after receipt of your Purchase Order.",

        Term_Warranty:
          data.Term_Warranty ||
          "12 months standard warranty against manufacturing defects.",

        Delivery_Address: data.Delivery_Address,

        HSN_Code: hsn,
        Make: make,

        Item_Discount: item.discount || 0,

        Term_Payment:
          data.Term_Payment ||
          "30% advance & balance at the time of dispatch",

        NABL: data.NABL,

        Created_at: new Date().toISOString(),
        Updated_at: new Date().toISOString(),

      };

      await db.insertByHeader(SHEET_NAME, rowData);

      insertedRows.push(rowData); // ⭐ push row

    }

    res.status(201).json({
      success: true,
      quotation_no: quotationNo,
      message: "Save created successfully",
      total_items: insertedRows.length,
      data: insertedRows
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      message: "Error creating save"
    });

  }
};



/**
 * GET ALL
 */

exports.getAllSave = async (req, res) => {

  try {

    const rows = await db.getAll(SHEET_NAME);

    const grouped = {};

    rows.forEach((r) => {

      if (!grouped[r.Quotation_No]) {

        grouped[r.Quotation_No] = {

          header: r,

          items: []

        };

      }

      grouped[r.Quotation_No].items.push({

        Item_Name: r.Item_Name,

        SPECIFICATIONS: r.SPECIFICATIONS,

        Qty: r.Qty,

        Unit_Price: r.Unit_Price,

        Total_Price: r.Total_Price,

        HSN_Code: r.HSN_Code,

        Make: r.Make

      });

    });

    res.json({

      success: true,

      data: Object.values(grouped)

    });

  } catch (error) {

    res.status(500).json({

      message: "Error fetching save"

    });

  }

};



/**
 * GET SINGLE
 */

exports.getSaveSingle = async (req, res) => {

  try {

    const { quotationNo } = req.params;

    const rows = await db.find(
      SHEET_NAME,
      "Quotation_No",
      quotationNo
    );

    if (!rows.length) {

      return res.status(404).json({
        message: "Save not found"
      });

    }

    const quotation = {

      header: rows[0],

      items: rows.map((r) => ({

        Item_Name: r.Item_Name,

        SPECIFICATIONS: r.SPECIFICATIONS,

        Qty: r.Qty,

        Unit_Price: r.Unit_Price,

        Total_Price: r.Total_Price,

        HSN_Code: r.HSN_Code,

        Make: r.Make

      }))

    };

    res.json({

      success: true,

      data: quotation

    });

  } catch (error) {

    res.status(500).json({

      message: "Error fetching save"

    });

  }

};
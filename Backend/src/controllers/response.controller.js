const db = require("../config/db.config");
const { uploadToDrive } = require("../utils/googleDrive");

const SHEET_NAME = "response";

/**
 * CREATE RESPONSE (Quotation Response)
 */

exports.createResponse = async (req, res) => {
  try {
    const data = req.body;

    let Image_URL = "";
    let Generated_PDF = "";

    // Upload Image (Single)
    if (req.files?.Image_URL?.[0]) {
      const file = req.files.Image_URL[0];
      Image_URL = await uploadToDrive(
        file.buffer,
        file.originalname,
        file.mimetype,
      );
    }

    // Upload PDF (Single)
    if (req.files?.Generated_PDF?.[0]) {
      const file = req.files.Generated_PDF[0];
      Generated_PDF = await uploadToDrive(
        file.buffer,
        file.originalname,
        file.mimetype,
      );
    }

    // Generate response sequence number (following save pattern)
    let quotationNo = data.Quotation_No;

    if (!quotationNo) {
      const allRows = await db.getAll(SHEET_NAME);
      const uniqueNumbers = [...new Set(allRows.map((r) => r.Quotation_No))];
      const nextNumber = uniqueNumbers.length + 1;
      quotationNo = `2025-26/RS/${String(nextNumber).padStart(4, "0")}`; // Using RS for Response
    }

    // Items
    const items = Array.isArray(data.ITEMS)
      ? data.ITEMS
      : JSON.parse(data.ITEMS || "[]");

    const insertedRows = [];

    for (const item of items) {
      // Auto fetch item master
      const itemData = await db.find(
        "Item_Master",
        "ITEM_NAME",
        item.item_name,
      );

      const master = itemData[0] || {};

      const unitPrice = item.unit_price || master.UNIT_PRICE || 0;

      const hsn = master.HSN_CODE || item.hsn_code || item.hsn || "";

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

        SPECIFICATIONS: item.specifications,
        Qty: item.qty,
        Unit_Price: unitPrice,
        Total_Price: totalPrice,

        Subtotal: data.Subtotal,

        Image_URL: Image_URL,

        Discount: data.Discount,
        GST: data.GST,
        Freight_Charges: data.Freight_Charges,
        Packaging_Charges: data.Packaging_Charges,
        Total_Amount: data.Total_Amount,

        Generated_PDF: Generated_PDF,

        ITEMS: item.item_name, // Store individual item name here

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
          data.Term_Payment || "30% advance & balance at the time of dispatch",

        NABL: item.nabl || data.NABL || "",
      };

      await db.insertByHeader(SHEET_NAME, rowData);

      insertedRows.push(rowData);
    }

    res.status(201).json({
      success: true,
      quotation_no: quotationNo,
      message: "Response created successfully",
      total_items: insertedRows.length,
      data: insertedRows,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Error creating response",
    });
  }
};

exports.getAllResponse = async (req, res) => {
  try {
    const { quotationNo } = req.query;

    const rows = await db.getAll(SHEET_NAME);

    // FILTER BY QUOTATION (or Response No in this context)
    const filteredRows = quotationNo
      ? rows.filter((r) => r.Quotation_No === quotationNo)
      : rows;

    if (quotationNo && !filteredRows.length) {
      return res.status(404).json({
        message: "Response not found",
      });
    }

    const grouped = {};

    // Pre-pass to count rows per quotation (used for intelligent splitting of old records)
    const rowCounts = {};
    filteredRows.forEach(r => {
      rowCounts[r.Quotation_No] = (rowCounts[r.Quotation_No] || 0) + 1;
    });

    filteredRows.forEach((r) => {
      if (!grouped[r.Quotation_No]) {
        grouped[r.Quotation_No] = {
          header: r,
          items: [],
        };
      }

      // Backward compatibility for old records where ITEMS stored the full JSON array
      if (!r.Item_Name && typeof r.ITEMS === 'string' && r.ITEMS.trim().startsWith("[")) {
        try {
          const parsedItems = JSON.parse(r.ITEMS);
          parsedItems.forEach((item) => {
            grouped[r.Quotation_No].items.push({
              Item_Name: item.item_name || item.Item_Name || "",
              SPECIFICATIONS: item.specifications || item.SPECIFICATIONS || "",
              Qty: item.qty || item.Qty || 1,
              Unit_Price: item.unit_price || item.Unit_Price || 0,
              Total_Price: item.total_price || item.Total_Price || 0,
              HSN_Code: item.hsn || item.hsn_code || item.HSN_Code || "",
              Make: item.make || item.Make || "",
              NABL: item.nabl || item.NABL || "",
              Item_Discount: item.discount_percent || item.discount || item.Item_Discount || 0,
            });
          });
        } catch (e) {
          console.error("Failed to parse ITEMS for Response Quotation:", r.Quotation_No, e);
        }
      } else {
        // Hyper-robust fallback for item names (covers old, new, and manual sheet variations)
        let resolvedItemName = 
          r.Item_Name || 
          r.ITEMS || 
          r['Item Name'] || 
          r['Item_name'] || 
          r['item_name'] || 
          r['Items'] || 
          "";
          
        // Smart split for old records:
        // 1. First check if SPECIFICATIONS contains the exact individual name
        if (resolvedItemName.includes(",") && r.SPECIFICATIONS && resolvedItemName.includes(r.SPECIFICATIONS)) {
          resolvedItemName = r.SPECIFICATIONS;
        } else if (resolvedItemName.includes(",")) {
          // 2. Intelligent fallback: if number of parts matches total row count for this quotation, split by index
          const parts = resolvedItemName.split(",").map(s => s.trim()).filter(Boolean);
          const totalRowsForThisQ = rowCounts[r.Quotation_No] || 0;
          const currentIndex = grouped[r.Quotation_No].items.length;
          
          if (parts.length === totalRowsForThisQ && currentIndex < parts.length) {
            resolvedItemName = parts[currentIndex];
          }
        }

        grouped[r.Quotation_No].items.push({
          Item_Name: resolvedItemName,
          SPECIFICATIONS: r.SPECIFICATIONS,
          Qty: r.Qty,
          Unit_Price: r.Unit_Price,
          Total_Price: r.Total_Price,
          HSN_Code: r.HSN_Code,
          Make: r.Make,
          NABL: r.NABL,
          Item_Discount: r.Item_Discount,
        });
      }
    });

    res.json({
      success: true,
      data: Object.values(grouped),
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching response",
    });
  }
};

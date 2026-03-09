const db = require("../config/db.config");
const { uploadToDrive } = require("../utils/googleDrive");

const SHEET_NAME = "save";

/**
 * CREATE SAVE (Quotation)
 */

exports.createSave = async (req, res) => {
  const startTime = Date.now();
  try {
    const data = req.body;
    const files = req.files || {};

    // 1. Parallelize Drive Uploads (All Images and PDF)
    const uploadPromises = [];

    // Process all Image_URL files
    const imageFiles = files.Image_URL || [];
    imageFiles.forEach((f, index) => {
      uploadPromises.push(
        uploadToDrive(f.buffer, f.originalname, f.mimetype).then((url) => ({
          type: "image",
          url,
          index,
        })),
      );
    });

    if (files.Generated_PDF?.[0]) {
      const f = files.Generated_PDF[0];
      uploadPromises.push(
        uploadToDrive(f.buffer, f.originalname, f.mimetype).then((url) => ({
          type: "pdf",
          url,
        })),
      );
    }

    // 2. Start fetching Item_Master and Sheet Data in parallel
    const masterDataPromise = db.getAll("Item_Master");
    const existingSavesPromise = data.Quotation_No
      ? Promise.resolve([])
      : db.getAll(SHEET_NAME);

    const [uploadResults, masterData, allRows] = await Promise.all([
      Promise.all(uploadPromises),
      masterDataPromise,
      existingSavesPromise,
    ]);

    const Generated_PDF =
      uploadResults.find((r) => r.type === "pdf")?.url || "";
    // Map uploaded images by their original index for correct association
    const uploadedImages = uploadResults.filter((r) => r.type === "image");
    const imageMap = new Map(uploadedImages.map((r) => [r.index, r.url]));

    // 3. Optimized Quotation No generation
    let quotationNo = data.Quotation_No;
    if (!quotationNo) {
      const uniqueNumbers = [...new Set(allRows.map((r) => r.Quotation_No))];
      const nextNumber = uniqueNumbers.length + 1;
      quotationNo = `2025-26/QT/${String(nextNumber).padStart(4, "0")}`;
    }

    // 4. Map Item Master for O(1) lookups
    const masterMap = new Map();
    masterData.forEach((item) => {
      if (item.ITEM_NAME) {
        masterMap.set(item.ITEM_NAME.toString().trim(), item);
      }
    });

    // 5. Prepare all rows for batch insertion
    const items = Array.isArray(data.ITEMS)
      ? data.ITEMS
      : JSON.parse(data.ITEMS || "[]");

    // Tracking how many items with images we've encountered to match with uploaded files
    let imageCounter = 0;

    const rowsToInsert = items.map((item) => {
      const master = masterMap.get(item.item_name?.toString().trim()) || {};
      const unitPrice = item.unit_price || master.UNIT_PRICE || 0;
      const hsn = master.HSN_CODE || item.hsn_code || "";
      const make = master.MAKE || item.make || "";
      const totalPrice = unitPrice * item.qty;

      // Match item image with uploaded URL based on order
      let currentItemImage = "";
      if (item.image) {
        currentItemImage = imageMap.get(imageCounter) || "";
        imageCounter++;
      } else if (uploadedImages.length === 1 && items.length > 1) {
        // Fallback: if only one global image uploaded, apply to all (legacy)
        currentItemImage = uploadedImages[0].url;
      }

      return {
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
        Image_URL: currentItemImage,
        Discount: data.Discount,
        GST: data.GST,
        Freight_Charges: data.Freight_Charges,
        Packaging_Charges: data.Packaging_Charges,
        Total_Amount: data.Total_Amount,
        Generated_PDF: Generated_PDF,
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
          data.Term_Payment || "30% advance & balance at the time of dispatch",
        NABL: data.NABL,
        Created_at: new Date().toISOString(),
        Updated_at: new Date().toISOString(),
      };
    });

    // 6. Batch Insert
    await db.insertMultipleByHeader(SHEET_NAME, rowsToInsert);

    const duration = Date.now() - startTime;
    console.log(`[createSave] Optimized Save took ${duration}ms`);

    res.status(201).json({
      success: true,
      quotation_no: quotationNo,
      message: "Save created successfully",
      total_items: rowsToInsert.length,
      duration: `${duration}ms`,
    });
  } catch (error) {
    console.error("[createSave] Optimization error:", error);
    res.status(500).json({ message: "Error creating save" });
  }
};

exports.getAllSave = async (req, res) => {
  try {
    const { quotationNo } = req.query;

    const rows = await db.getAll(SHEET_NAME);

    // FILTER BY QUOTATION
    const filteredRows = quotationNo
      ? rows.filter((r) => r.Quotation_No === quotationNo)
      : rows;

    if (quotationNo && !filteredRows.length) {
      return res.status(404).json({
        message: "Save not found",
      });
    }

    const grouped = {};

    filteredRows.forEach((r) => {
      if (!grouped[r.Quotation_No]) {
        grouped[r.Quotation_No] = {
          header: r,
          items: [],
        };
      }

      grouped[r.Quotation_No].items.push({
        Item_Name: r.Item_Name,
        SPECIFICATIONS: r.SPECIFICATIONS,
        Qty: r.Qty,
        Unit_Price: r.Unit_Price,
        Total_Price: r.Total_Price,
        HSN_Code: r.HSN_Code,
        Make: r.Make,
        NABL: r.NABL,
        Item_Discount: r.Item_Discount,
      });
    });

    res.json({
      success: true,
      data: Object.values(grouped),
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching save",
    });
  }
};

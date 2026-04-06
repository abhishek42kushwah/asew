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

    // 2. Start fetching Item_Master and Recent Sheet Data in parallel
    const masterDataPromise = db.getAll("Item_Master");
    const existingSavesPromise = Promise.resolve([]); // No longer needed for sequence lookup

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

    // 3. Optimized Quotation No generation (Max + 1 logic)
    let quotationNo = data.Quotation_No;
    const isUpdate = !!quotationNo;

    if (!isUpdate) {
      // New 2026-27 series starts from 0111.
      // Fetch ALL rows from the save sheet and find the max in the new series only.
      // Entries like 2026-27/QT/2009 are excluded because they don't start with "2026-27/QT/0".
      let maxSeq = 110; 
      // Optimized: Only check latest 100 rows to find the max sequence
      const lastSaveRows = await db.getTail(SHEET_NAME, 100);
      lastSaveRows.forEach((r) => {
        const no = (r.Quotation_No || "").trim();
        if (no.startsWith("2026-27/QT/0")) {
          const seq = parseInt(no.replace("2026-27/QT/", ""), 10);
          if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
        }
      });
      const nextNumber = maxSeq + 1;
      quotationNo = `2026-27/QT/${String(nextNumber).padStart(4, "0")}`;
    } else {
      // If it's an update, delete existing rows for this quotation first
      await db.deleteRowsByColumn(SHEET_NAME, "Quotation_No", quotationNo);
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

    // Parse column visibility settings from the frontend
    const showFields = typeof data.showFields === 'string' 
      ? JSON.parse(data.showFields) 
      : (data.showFields || { hsn: true, nabl: true, make: true, discount: true });

    const rowsToInsert = items.map((item, idx) => {
      const master = masterMap.get(item.item_name?.toString().trim()) || {};
      const unitPrice = item.unit_price || master.UNIT_PRICE || 0;
      
      // Determine values based on column visibility (showFields)
      const hsn = showFields.hsn ? (master.HSN_CODE || item.hsn_code || item.hsn || "") : "";
      const make = showFields.make ? (master.MAKE || item.make || "") : "";
      const nabl = showFields.nabl ? (item.nabl || data.NABL || master.NABL || "") : "";
      const itemDiscount = showFields.discount ? (item.discount || item.discount_percent || 0) : 0;

      const totalPrice = unitPrice * item.qty;
      const isLastItem = idx === items.length - 1;

      // Match item image with uploaded URL based on order
      let currentItemImage = "";
      if (item.image) {
        currentItemImage = imageMap.get(imageCounter) || "";
        imageCounter++;
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
        SPECIFICATIONS: item.specifications,
        Qty: item.qty,
        Unit_Price: unitPrice,
        Total_Price: totalPrice,
        Subtotal: data.Subtotal,
        Image_URL: currentItemImage,
        Discount: data.Discount,
        Discount_Type: data.DiscountType,
        GST: data.GST,
        Freight_Charges: data.Freight_Charges,
        Freight_Type: data.FreightType,
        Packaging_Charges: data.Packaging_Charges,
        Packaging_Type: data.PackagingType,
        Total_Amount: data.Total_Amount,
        Generated_PDF: isLastItem ? Generated_PDF : "",
        ITEMS: item.item_name,
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
        Item_Discount: itemDiscount,
        Term_Payment:
          data.Term_Payment || "30% advance & balance at the time of dispatch",
        NABL: nabl,
      };
    });

    // 6. Batch Insert
    await db.insertMultipleByHeader(SHEET_NAME, rowsToInsert);

    const duration = Date.now() - startTime;

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
    const { quotationNo, limit = 1500 } = req.query;

    const rows = quotationNo 
      ? await db.find(SHEET_NAME, "Quotation_No", quotationNo) 
      : await db.getTail(SHEET_NAME, parseInt(limit));

    // ROWS ARE ALREADY FILTERED OR LIMITED
    const filteredRows = rows;

    if (quotationNo && !filteredRows.length) {
      return res.status(404).json({
        message: "Save not found",
      });
    }

    const grouped = {};
    const uniformItems = {};

    // 1st pass: Pre-calculate uniformity and row counts per quotation
    const rowCounts = {};
    filteredRows.forEach(r => {
      rowCounts[r.Quotation_No] = (rowCounts[r.Quotation_No] || 0) + 1;
      
      if (uniformItems[r.Quotation_No] === undefined) {
        uniformItems[r.Quotation_No] = r.ITEMS;
      } else if (uniformItems[r.Quotation_No] !== r.ITEMS) {
        uniformItems[r.Quotation_No] = false;
      }
    });

    filteredRows.forEach((r) => {
      if (!grouped[r.Quotation_No]) {
        grouped[r.Quotation_No] = {
          header: r,
          items: [],
        };
      }

      // Pick up Generated_PDF/Image_URL from whichever row has them (stored on last row)
      if (r.Generated_PDF && !grouped[r.Quotation_No].header.Generated_PDF) {
        grouped[r.Quotation_No].header.Generated_PDF = r.Generated_PDF;
      }
      if (r.Image_URL && !grouped[r.Quotation_No].header.Image_URL) {
        grouped[r.Quotation_No].header.Image_URL = r.Image_URL;
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
          console.error("Failed to parse ITEMS for Quotation:", r.Quotation_No, e);
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
        } else if (resolvedItemName.includes(",") && uniformItems[r.Quotation_No] !== false) {
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
      message: "Error fetching save",
    });
  }
};

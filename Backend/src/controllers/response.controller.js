const db = require("../config/db.config");
const { uploadToDrive } = require("../utils/googleDrive");

const SHEET_NAME = "response";

/**
 * CREATE RESPONSE (Quotation Response)
 */

exports.createResponse = async (req, res) => {
  try {
    const data = req.body;

    // 1. Parallelize Drive Uploads + Item_Master fetch + Quotation No lookup
    const uploadPromises = [];

    if (req.files?.Image_URL?.[0]) {
      const file = req.files.Image_URL[0];
      uploadPromises.push(
        uploadToDrive(file.buffer, file.originalname, file.mimetype).then((url) => ({
          type: "image", url,
        })),
      );
    }

    if (req.files?.Generated_PDF?.[0]) {
      const file = req.files.Generated_PDF[0];
      uploadPromises.push(
        uploadToDrive(file.buffer, file.originalname, file.mimetype).then((url) => ({
          type: "pdf", url,
        })),
      );
    }

    const masterDataPromise = db.getAll("Item_Master");
    const existingRowsPromise = data.Quotation_No
      ? Promise.resolve([])
      : db.getTail(SHEET_NAME, 50); // Just get last 50 for max sequence lookup

    const [uploadResults, allMasterItems, allRows] = await Promise.all([
      Promise.all(uploadPromises),
      masterDataPromise,
      existingRowsPromise,
    ]);

    const Generated_PDF = uploadResults.find((r) => r.type === "pdf")?.url || "";
    // Map uploaded images by their original order (following the convention in save.controller.js)
    const uploadedImages = uploadResults.filter((r) => r.type === "image");
    const imageMap = new Map(uploadedImages.map((r, index) => [index, r.url]));

    // 2. Generate quotation number
    let quotationNo = data.Quotation_No;
    if (!quotationNo) {
      let maxSeq = 0;
      allRows.forEach((r) => {
        const no = r.Quotation_No;
        if (no) {
          const parts = no.split("/");
          const seq = parseInt(parts[parts.length - 1]);
          if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
        }
      });
      quotationNo = `2025-26/RS/${String(maxSeq + 1).padStart(4, "0")}`;
    } else {
      // If it's an update, delete existing rows for this quotation first
      await db.deleteRowsByColumn(SHEET_NAME, "Quotation_No", quotationNo);
    }

    // 3. Build all rows in memory (O(1) master lookup)
    const normalize = (s) => s?.toString().trim().toLowerCase() || "";
    const masterMap = new Map();
    allMasterItems.forEach((m) => {
      if (m.ITEM_NAME) masterMap.set(normalize(m.ITEM_NAME), m);
    });

    const items = Array.isArray(data.ITEMS)
      ? data.ITEMS
      : JSON.parse(data.ITEMS || "[]");

    let imageCounter = 0;
    const rowsToInsert = items.map((item, idx) => {
      const master = masterMap.get(normalize(item.item_name)) || {};
      const unitPrice = item.unit_price || master.UNIT_PRICE || 0;
      const hsn = master.HSN_CODE || item.hsn_code || item.hsn || "";
      const make = master.MAKE || item.make || "";
      const totalPrice = unitPrice * item.qty;
      const isLastItem = idx === items.length - 1;

      // Match item image based on order
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
        Item_Discount: item.discount || 0,
        Term_Payment:
          data.Term_Payment || "30% advance & balance at the time of dispatch",
        NABL: item.nabl || data.NABL || "",
      };
    });

    // 4. Batch insert all rows at once (1 API call instead of N)
    await db.insertMultipleByHeader(SHEET_NAME, rowsToInsert);

    res.status(201).json({
      success: true,
      quotation_no: quotationNo,
      message: "Response created successfully",
      total_items: rowsToInsert.length,
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
    const { quotationNo, limit = 1500 } = req.query;

    const rows = quotationNo 
      ? await db.find(SHEET_NAME, "Quotation_No", quotationNo) 
      : await db.getTail(SHEET_NAME, parseInt(limit));

    const filteredRows = rows;

    if (quotationNo && !filteredRows.length) {
      return res.status(404).json({
        message: "Response not found",
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
      message: "Error fetching response",
    });
  }
};

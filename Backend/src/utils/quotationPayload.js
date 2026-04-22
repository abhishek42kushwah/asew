const { normalizeLookupValue } = require("./quotationFormatter");

const DEFAULT_SHOW_FIELDS = {
  hsn: true,
  nabl: true,
  make: true,
  discount: true,
};

const parseItems = (rawItems) =>
  Array.isArray(rawItems) ? rawItems : JSON.parse(rawItems || "[]");

const parseShowFields = (rawShowFields) => {
  if (typeof rawShowFields === "string") {
    try {
      return { ...DEFAULT_SHOW_FIELDS, ...JSON.parse(rawShowFields) };
    } catch (error) {
      console.warn("[quotationPayload] Invalid showFields JSON:", error.message);
    }
  }

  return { ...DEFAULT_SHOW_FIELDS, ...(rawShowFields || {}) };
};

const buildItemMasterMap = (masterRows) => {
  const masterMap = new Map();

  masterRows.forEach((item) => {
    if (item.ITEM_NAME) {
      masterMap.set(normalizeLookupValue(item.ITEM_NAME), item);
    }
  });

  return masterMap;
};

const buildQuotationRows = ({
  data,
  quotationNo,
  masterMap,
  generatedPdfUrl = "",
  imageMap = new Map(),
}) => {
  const items = parseItems(data.ITEMS);
  const showFields = parseShowFields(data.showFields);
  let imageCounter = 0;

  return items.map((item, index) => {
    const master = masterMap.get(normalizeLookupValue(item.item_name)) || {};
    const qty = Number(item.qty) || 0;
    const unitPrice = Number(item.unit_price || master.UNIT_PRICE || 0);
    const itemDiscount = showFields.discount
      ? Number(item.discount || item.discount_percent || 0)
      : 0;
    const gstPercent = Number(item.gst_percent || 18);
    const gstAmount = Number(item.gst_amount || 0);
    const taxablePrice = unitPrice * qty * (1 - itemDiscount / 100);
    const totalPrice = Number(item.total_price || taxablePrice + gstAmount);
    const isLastItem = index === items.length - 1;

    let currentItemImage = "";
    if (item.image) {
      currentItemImage = imageMap.get(imageCounter) || "";
      imageCounter += 1;
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
      Qty: qty,
      Unit_Price: unitPrice,
      Total_Price: totalPrice,
      Subtotal: data.Subtotal,
      Image_URL: currentItemImage,
      Discount: data.Discount,
      Discount_Type: data.DiscountType,
      GST: data.GST,
      Total_GST: data.Total_GST,
      Item_GST_Percent: gstPercent,
      Item_GST_Amount: gstAmount,
      Freight_Charges: data.Freight_Charges,
      Freight_Type: data.FreightType,
      Packaging_Charges: data.Packaging_Charges,
      Packaging_Type: data.PackagingType,
      Total_Amount: data.Total_Amount,
      Generated_PDF: isLastItem ? generatedPdfUrl : "",
      ITEMS: item.item_name,
      Freight_Note: data.Freight_Note,
      Packaging_Note: data.Packaging_Note,
      Term_Tax: data.Term_Tax || "Extra, GST @ 18%",
      Term_Delivery:
        data.Term_Delivery || "1-2 weeks after receipt of your Purchase Order.",
      Term_Warranty:
        data.Term_Warranty ||
        "12 months standard warranty against manufacturing defects.",
      Delivery_Address: data.Delivery_Address,
      HSN_Code: showFields.hsn
        ? master.HSN_CODE || item.hsn_code || item.hsn || ""
        : "",
      Make: showFields.make ? master.MAKE || item.make || "" : "",
      Item_Discount: itemDiscount,
      Term_Payment:
        data.Term_Payment || "30% advance & balance at the time of dispatch",
      NABL: showFields.nabl
        ? item.nabl || data.NABL || master.NABL || ""
        : "",
    };
  });
};

module.exports = {
  buildItemMasterMap,
  buildQuotationRows,
  parseItems,
  parseShowFields,
};

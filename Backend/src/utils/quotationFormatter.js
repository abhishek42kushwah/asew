const normalizeLookupValue = (value) =>
  value?.toString().trim().replace(/\s+/g, " ").toLowerCase() || "";

const mapLegacyItem = (item) => ({
  Item_Name: item.item_name || item.Item_Name || "",
  SPECIFICATIONS: item.specifications || item.SPECIFICATIONS || "",
  Qty: item.qty || item.Qty || 1,
  Unit_Price: item.unit_price || item.Unit_Price || 0,
  Total_Price: item.total_price || item.Total_Price || 0,
  HSN_Code: item.hsn || item.hsn_code || item.HSN_Code || "",
  Make: item.make || item.Make || "",
  NABL: item.nabl || item.NABL || "",
  Item_Discount:
    item.discount_percent || item.discount || item.Item_Discount || 0,
  GST_Percent: item.gst_percent || item.GST_Percent || 0,
  GST_Amount: item.gst_amount || item.GST_Amount || 0,
});

const resolveItemName = ({
  row,
  currentIndex,
  totalRowsForQuotation,
  uniformItemsValue,
}) => {
  let resolvedItemName =
    row.Item_Name ||
    row.ITEMS ||
    row["Item Name"] ||
    row.Item_name ||
    row.item_name ||
    row.Items ||
    "";

  if (
    resolvedItemName.includes(",") &&
    row.SPECIFICATIONS &&
    resolvedItemName.includes(row.SPECIFICATIONS)
  ) {
    return row.SPECIFICATIONS;
  }

  if (resolvedItemName.includes(",") && uniformItemsValue !== false) {
    const parts = resolvedItemName
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length === totalRowsForQuotation && currentIndex < parts.length) {
      return parts[currentIndex];
    }
  }

  return resolvedItemName;
};

const getRowBatchKey = (row) => row.Timestamp?.toString().trim() || "";

const selectLatestBatchRows = (quotationRows) => {
  const timestampGroups = new Map();

  quotationRows.forEach((row) => {
    const batchKey = getRowBatchKey(row);
    if (!batchKey) {
      return;
    }

    if (!timestampGroups.has(batchKey)) {
      timestampGroups.set(batchKey, []);
    }

    timestampGroups.get(batchKey).push(row);
  });

  if (timestampGroups.size === 0) {
    return quotationRows;
  }

  const timestampedCount = Array.from(timestampGroups.values()).reduce(
    (count, rows) => count + rows.length,
    0,
  );

  if (timestampGroups.size === 1 && timestampedCount === quotationRows.length) {
    return quotationRows;
  }

  let latestRows = quotationRows;
  timestampGroups.forEach((rows) => {
    latestRows = rows;
  });

  return latestRows;
};

const selectRowsForLatestBatches = (rows) => {
  const rowsByQuotationNo = new Map();

  rows.forEach((row) => {
    const quotationNo = row?.Quotation_No;
    if (!quotationNo) {
      return;
    }

    if (!rowsByQuotationNo.has(quotationNo)) {
      rowsByQuotationNo.set(quotationNo, []);
    }

    rowsByQuotationNo.get(quotationNo).push(row);
  });

  return Array.from(rowsByQuotationNo.values()).flatMap(selectLatestBatchRows);
};

const groupQuotationRows = (rows) => {
  const rowsForGrouping = selectRowsForLatestBatches(rows);
  const grouped = {};
  const uniformItems = {};
  const rowCounts = {};

  rowsForGrouping.forEach((row) => {
    if (!row?.Quotation_No) {
      return;
    }

    rowCounts[row.Quotation_No] = (rowCounts[row.Quotation_No] || 0) + 1;

    if (uniformItems[row.Quotation_No] === undefined) {
      uniformItems[row.Quotation_No] = row.ITEMS;
    } else if (uniformItems[row.Quotation_No] !== row.ITEMS) {
      uniformItems[row.Quotation_No] = false;
    }
  });

  rowsForGrouping.forEach((row) => {
    if (!row?.Quotation_No) {
      return;
    }

    if (!grouped[row.Quotation_No]) {
      grouped[row.Quotation_No] = {
        header: { ...row },
        items: [],
      };
    }

    if (row.Generated_PDF && !grouped[row.Quotation_No].header.Generated_PDF) {
      grouped[row.Quotation_No].header.Generated_PDF = row.Generated_PDF;
    }

    if (row.Image_URL && !grouped[row.Quotation_No].header.Image_URL) {
      grouped[row.Quotation_No].header.Image_URL = row.Image_URL;
    }

    if (
      !row.Item_Name &&
      typeof row.ITEMS === "string" &&
      row.ITEMS.trim().startsWith("[")
    ) {
      try {
        const parsedItems = JSON.parse(row.ITEMS);
        parsedItems.forEach((item) => {
          grouped[row.Quotation_No].items.push(mapLegacyItem(item));
        });
      } catch (error) {
        console.error(
          "Failed to parse legacy quotation items:",
          row.Quotation_No,
          error,
        );
      }

      return;
    }

    grouped[row.Quotation_No].items.push({
      Item_Name: resolveItemName({
        row,
        currentIndex: grouped[row.Quotation_No].items.length,
        totalRowsForQuotation: rowCounts[row.Quotation_No] || 0,
        uniformItemsValue: uniformItems[row.Quotation_No],
      }),
      SPECIFICATIONS: row.SPECIFICATIONS,
      Qty: row.Qty,
      Unit_Price: row.Unit_Price,
      Total_Price: row.Total_Price,
      HSN_Code: row.HSN_Code,
      Make: row.Make,
      NABL: row.NABL,
      Item_Discount: row.Item_Discount,
      GST_Percent: row.Item_GST_Percent || row.GST_Percent,
      GST_Amount: row.Item_GST_Amount || row.GST_Amount,
    });
  });

  return Object.values(grouped);
};

const buildGroupedQuotation = (rows) => groupQuotationRows(rows)[0] || null;

module.exports = {
  buildGroupedQuotation,
  groupQuotationRows,
  normalizeLookupValue,
};

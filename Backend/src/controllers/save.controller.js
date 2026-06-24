const db = require("../config/db.config");
const { uploadToDrive } = require("../utils/googleDrive");
const { groupQuotationRows } = require("../utils/quotationFormatter");
const { buildQuotationRows } = require("../utils/quotationPayload");
const {
  allocateSaveQuotationNumber,
  deleteQuotationRows,
  getItemMasterMap,
  getQuotationEntry,
  upsertQuotationEntry,
} = require("../utils/quotationCache");

const { withQuotationLock } = require("../utils/quotationLock");

const SHEET_NAME = "save";

const uploadQuotationAssets = async (files = {}) => {
  const uploadPromises = [];
  const imageFiles = files.Image_URL || [];

  imageFiles.forEach((file, index) => {
    uploadPromises.push(
      uploadToDrive(file.buffer, file.originalname, file.mimetype).then((url) => ({
        type: "image",
        index,
        url,
      })),
    );
  });

  if (files.Generated_PDF?.[0]) {
    const file = files.Generated_PDF[0];
    uploadPromises.push(
      uploadToDrive(file.buffer, file.originalname, file.mimetype).then((url) => ({
        type: "pdf",
        url,
      })),
    );
  }

  const uploadResults = await Promise.all(uploadPromises);
  const imageMap = new Map(
    uploadResults
      .filter((result) => result.type === "image")
      .map((result) => [result.index, result.url]),
  );

  return {
    generatedPdfUrl:
      uploadResults.find((result) => result.type === "pdf")?.url || "",
    imageMap,
  };
};

exports.createSave = async (req, res) => {
  const startedAt = Date.now();

  try {
    const data = req.body;
    const files = req.files || {};

    const [assets, masterMap] = await Promise.all([
      uploadQuotationAssets(files),
      getItemMasterMap(),
    ]);

    let quotationNo = data.Quotation_No?.toString().trim();

    // [DUP-DEBUG] Backend item count received
    let receivedItemCount = 0;
    try {
      receivedItemCount = JSON.parse(data.ITEMS || "[]").length;
    } catch {
      receivedItemCount = -1;
    }
    console.log(
      `[DUP-DEBUG][Backend] createSave Quotation_No=${quotationNo || "(new)"} received items=${receivedItemCount}`,
    );

    // Serialize the sheet mutation per quotation so concurrent saves of the
    // same quotation can't double-append. Asset uploads above are already done
    // and run in parallel; only the delete+append needs ordering.
    // A brand-new quotation mints its number HERE, at save time, atomically
    // under a shared lock — instead of trusting the number the client previewed
    // when the form opened. Two systems that opened the form and saw the same
    // preview no longer write to the same quotation. A new quotation also skips
    // the (expensive, full-sheet) delete since it has no existing rows to
    // replace. An edit (isNew=false) keeps the provided number and replaces.
    const isNew = data.isNew === "true" || data.isNew === true || !quotationNo;
    const lockKey = isNew ? "__new_save__" : quotationNo;
    const { resolvedQuotationNo, insertedCount } = await withQuotationLock(
      lockKey,
      async () => {
        let resolvedNo;

        if (isNew) {
          resolvedNo = await allocateSaveQuotationNumber();
        } else {
          resolvedNo = quotationNo;
          const deleteResult = await deleteQuotationRows(SHEET_NAME, resolvedNo);
          // [DUP-DEBUG] How many existing rows were removed before re-inserting.
          // If deleted=0 here but old rows exist in the sheet, the new rows will
          // be appended after them -> item repetition.
          console.log(
            `[DUP-DEBUG][Backend] deleteQuotationRows(${resolvedNo}) ->`,
            deleteResult,
          );
        }

        const rowsToInsert = buildQuotationRows({
          data,
          quotationNo: resolvedNo,
          masterMap,
          generatedPdfUrl: assets.generatedPdfUrl,
          imageMap: assets.imageMap,
        });

        const appendMetadata = await db.insertMultipleByHeader(
          SHEET_NAME,
          rowsToInsert,
        );

        // [DUP-DEBUG] Rows actually written to Sheets (count + appended range)
        console.log(
          `[DUP-DEBUG][Backend] rows written to Sheets for ${resolvedNo}: count=${rowsToInsert.length}`,
          appendMetadata,
        );
        await upsertQuotationEntry(
          SHEET_NAME,
          resolvedNo,
          rowsToInsert,
          appendMetadata,
        );

        return {
          resolvedQuotationNo: resolvedNo,
          insertedCount: rowsToInsert.length,
        };
      },
    );

    res.status(201).json({
      success: true,
      quotation_no: resolvedQuotationNo,
      message: "Save created successfully",
      total_items: insertedCount,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("[createSave] Optimization error:", error);
    res.status(500).json({ message: "Error creating save" });
  }
};

exports.getAllSave = async (req, res) => {
  try {
    const { quotationNo, limit = 1500 } = req.query;

    if (quotationNo) {
      const entry = await getQuotationEntry(SHEET_NAME, quotationNo);

      if (!entry) {
        return res.status(404).json({
          message: "Save not found",
        });
      }

      return res.json({
        success: true,
        data: [entry.data],
      });
    }

    const rows = await db.getTail(SHEET_NAME, parseInt(limit, 10));

    res.json({
      success: true,
      data: groupQuotationRows(rows),
    });
  } catch (error) {
    console.error("[getAllSave] Error:", error);
    res.status(500).json({
      message: "Error fetching save",
    });
  }
};

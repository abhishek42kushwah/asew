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

    const isNew = data.isNew === "true" || data.isNew === true || !quotationNo;

    // Append this quotation's rows for an already-resolved number.
    const writeRows = async (resolvedNo) => {
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
    };

    let outcome;
    if (!isNew) {
      // Edit: serialize per quotation so the delete+append can't race for the
      // same number (which would double-append items).
      outcome = await withQuotationLock(quotationNo, async () => {
        const deleteResult = await deleteQuotationRows(SHEET_NAME, quotationNo);
        console.log(
          `[DUP-DEBUG][Backend] deleteQuotationRows(${quotationNo}) ->`,
          deleteResult,
        );
        return writeRows(quotationNo);
      });
    } else {
      const alloc = await allocateSaveQuotationNumber();
      if (alloc.viaPg) {
        // Postgres gave a globally-unique number, so concurrent new saves use
        // DIFFERENT numbers and run in parallel. Lock on the unique number only
        // to make an accidental double-submit of the same number idempotent.
        outcome = await withQuotationLock(alloc.quotationNo, () =>
          writeRows(alloc.quotationNo),
        );
      } else {
        // Fallback (Postgres down): the number came from the sheet peek and two
        // concurrent saves could collide. Serialize new saves on this instance
        // and RE-allocate inside the lock so the sheet re-peek advances between
        // writers.
        outcome = await withQuotationLock("__new_save__", async () => {
          const fresh = await allocateSaveQuotationNumber();
          return writeRows(fresh.quotationNo);
        });
      }
    }

    const { resolvedQuotationNo, insertedCount } = outcome;

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

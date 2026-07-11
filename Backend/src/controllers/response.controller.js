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

const SHEET_NAME = "response";

const uploadQuotationAssets = async (files = {}) => {
  const uploadPromises = [];
  const imageFiles = files.Image_URL || [];

  imageFiles.forEach((file, index) => {
    uploadPromises.push(
      uploadToDrive(file.buffer, file.originalname, file.mimetype)
        .then((url) => ({ type: "image", index, url }))
        // A single failed upload must NOT abort the whole save (which would lose
        // all row data). Drop it -> that row just gets a blank Image_URL;
        // imageMap stays keyed by the original index so survivors still align.
        .catch(() => null),
    );
  });

  if (files.Generated_PDF?.[0]) {
    const file = files.Generated_PDF[0];
    uploadPromises.push(
      uploadToDrive(file.buffer, file.originalname, file.mimetype)
        .then((url) => ({ type: "pdf", url }))
        .catch(() => null),
    );
  }

  const uploadResults = (await Promise.all(uploadPromises)).filter(Boolean);
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

exports.createResponse = async (req, res) => {
  const startedAt = Date.now();

  try {
    const data = req.body;

    const [assets, masterMap] = await Promise.all([
      uploadQuotationAssets(req.files || {}),
      getItemMasterMap(),
    ]);

    const quotationNo = data.Quotation_No?.toString().trim();

    // New quotation: mint the number HERE (atomically, under a shared lock)
    // rather than trusting the client-previewed number, and skip the expensive
    // full-sheet delete since there are no existing rows. Edit: keep the number
    // and replace. This stops two systems that saw the same preview from
    // colliding on the same quotation.
    const isNew = data.isNew === "true" || data.isNew === true || !quotationNo;

    const writeRows = async (resolvedNo) => {
      const rowsToInsert = buildQuotationRows({
        data,
        quotationNo: resolvedNo,
        masterMap,
        // A large quotation uploads its PDF directly to Drive and sends only the
        // link (Generated_PDF_URL); otherwise the PDF file was uploaded here.
        generatedPdfUrl: assets.generatedPdfUrl || data.Generated_PDF_URL || "",
        imageMap: assets.imageMap,
      });

      const appendMetadata = await db.insertMultipleByHeader(
        SHEET_NAME,
        rowsToInsert,
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
      // Edit: serialize per quotation so delete+append can't race for the same No.
      outcome = await withQuotationLock(quotationNo, async () => {
        await deleteQuotationRows(SHEET_NAME, quotationNo);
        return writeRows(quotationNo);
      });
    } else {
      // A response uses the SHARED QT number series (highest of the save +
      // response sheets, +1) — the same atomic counter Save draws from — so the
      // submitted number matches the QT number shown on the form, and a number
      // is never reused across the two sheets.
      const alloc = await allocateSaveQuotationNumber();
      if (alloc.viaPg) {
        // Globally-unique number -> concurrent new submits run in parallel.
        outcome = await withQuotationLock(alloc.quotationNo, () =>
          writeRows(alloc.quotationNo),
        );
      } else {
        // Fallback (Postgres down): serialize and re-allocate inside the lock.
        outcome = await withQuotationLock("__new_response__", async () => {
          const fresh = await allocateSaveQuotationNumber();
          return writeRows(fresh.quotationNo);
        });
      }
    }

    const { resolvedQuotationNo, insertedCount } = outcome;

    res.status(201).json({
      success: true,
      quotation_no: resolvedQuotationNo,
      message: "Response created successfully",
      total_items: insertedCount,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("[createResponse] Optimization error:", error);
    res.status(500).json({
      message: "Error creating response",
    });
  }
};

exports.getAllResponse = async (req, res) => {
  try {
    const { quotationNo, limit = 1500 } = req.query;

    if (quotationNo) {
      const entry = await getQuotationEntry(SHEET_NAME, quotationNo);

      if (!entry) {
        return res.status(404).json({
          message: "Response not found",
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
    console.error("[getAllResponse] Error:", error);
    res.status(500).json({
      message: "Error fetching response",
    });
  }
};

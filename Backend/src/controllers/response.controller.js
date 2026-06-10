const db = require("../config/db.config");
const { uploadToDrive } = require("../utils/googleDrive");
const { groupQuotationRows } = require("../utils/quotationFormatter");
const { buildQuotationRows } = require("../utils/quotationPayload");
const {
  deleteQuotationRows,
  getItemMasterMap,
  getNextResponseQuotationNumber,
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

exports.createResponse = async (req, res) => {
  const startedAt = Date.now();

  try {
    const data = req.body;

    const [assets, masterMap] = await Promise.all([
      uploadQuotationAssets(req.files || {}),
      getItemMasterMap(),
    ]);

    const quotationNo = data.Quotation_No?.toString().trim();

    // Serialize the sheet mutation per quotation so concurrent submits of the
    // same quotation can't double-append (each item written twice).
    const lockKey = quotationNo || "__new_response__";
    const { resolvedQuotationNo, insertedCount } = await withQuotationLock(
      lockKey,
      async () => {
        let resolvedNo = quotationNo;

        if (!resolvedNo) {
          resolvedNo = await getNextResponseQuotationNumber();
        } else {
          await deleteQuotationRows(SHEET_NAME, resolvedNo);
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

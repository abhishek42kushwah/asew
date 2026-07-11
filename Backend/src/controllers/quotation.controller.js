const db = require("../config/db.config");
const {
  getNextSaveQuotationNumber,
  invalidateSheetCache,
  lookupQuotation,
} = require("../utils/quotationCache");
const { checkHealth } = require("../utils/quotationSequence");
const {
  createResumableUpload,
  finalizeDriveFile,
} = require("../utils/googleDrive");

exports.getNextQuotationNumber = async (req, res) => {
  const startedAt = Date.now();

  try {
    const nextQuotationNo = await getNextSaveQuotationNumber();

    res.json({
      success: true,
      nextQuotationNo,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("[getNextQuotationNumber] Error:", error);
    res.status(500).json({
      success: false,
      message: "Error calculating next quotation number",
    });
  }
};

exports.getDbHealth = async (req, res) => {
  const result = await checkHealth();
  res.status(result.ok ? 200 : 503).json(result);
};

// Start a Drive resumable upload session; the browser PUTs the PDF straight to
// the returned URL, bypassing Vercel's 4.5MB request-body cap.
exports.createPdfSession = async (req, res) => {
  try {
    const filename = (req.body?.filename || "quotation.pdf").toString();
    const mimeType = (req.body?.mimeType || "application/pdf").toString();
    const uploadUrl = await createResumableUpload(filename, mimeType);
    res.json({ success: true, uploadUrl });
  } catch (error) {
    console.error("[createPdfSession] Error:", error.message);
    res
      .status(500)
      .json({ success: false, message: "Could not start PDF upload" });
  }
};

// After the browser finishes the direct upload, make the file public and write
// its link into the quotation's Generated_PDF column.
exports.finalizePdf = async (req, res) => {
  try {
    const { fileId, quotationNo, source } = req.body || {};
    if (!fileId || !quotationNo) {
      return res
        .status(400)
        .json({ success: false, message: "fileId and quotationNo are required" });
    }
    const sheetName = source === "response" ? "response" : "save";
    const url = await finalizeDriveFile(fileId);
    await db.bulkUpdateByColumn(sheetName, "Quotation_No", [
      { matchValue: quotationNo.toString().trim(), data: { Generated_PDF: url } },
    ]);
    invalidateSheetCache(sheetName);
    res.json({ success: true, url });
  } catch (error) {
    console.error("[finalizePdf] Error:", error.message);
    res
      .status(500)
      .json({ success: false, message: "Could not finalize PDF" });
  }
};

exports.lookupQuotation = async (req, res) => {
  const startedAt = Date.now();

  try {
    const quotationNo = req.query.quotationNo?.toString().trim();

    if (!quotationNo) {
      return res.status(400).json({
        success: false,
        message: "quotationNo is required",
      });
    }

    const result = await lookupQuotation(quotationNo);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Quotation not found",
      });
    }

    res.json({
      success: true,
      source: result.source,
      data: result.data,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("[lookupQuotation] Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching quotation",
    });
  }
};

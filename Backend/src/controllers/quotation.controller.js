const {
  getNextSaveQuotationNumber,
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

// Start a Drive resumable upload session for ANY file (PDF or image); the
// browser PUTs the bytes straight to the returned URL, bypassing Vercel's
// 4.5MB request-body cap.
exports.createDriveSession = async (req, res) => {
  try {
    const filename = (req.body?.filename || "quotation-file").toString();
    const mimeType = (req.body?.mimeType || "application/octet-stream").toString();
    const uploadUrl = await createResumableUpload(filename, mimeType);
    res.json({ success: true, uploadUrl });
  } catch (error) {
    console.error("[createDriveSession] Error:", error.message);
    res
      .status(500)
      .json({ success: false, message: "Could not start upload" });
  }
};

// After the browser finishes a direct upload, make the file public and return
// its shareable link. The link is then embedded in the (small) save request —
// as Generated_PDF_URL for the PDF, or per-item image URLs — so no bytes ever
// pass through the server.
exports.finalizeDriveUpload = async (req, res) => {
  try {
    const { fileId } = req.body || {};
    if (!fileId) {
      return res
        .status(400)
        .json({ success: false, message: "fileId is required" });
    }
    const url = await finalizeDriveFile(fileId);
    res.json({ success: true, url });
  } catch (error) {
    console.error("[finalizeDriveUpload] Error:", error.message);
    res
      .status(500)
      .json({ success: false, message: "Could not finalize upload" });
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

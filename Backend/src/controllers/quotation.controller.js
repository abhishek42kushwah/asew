const {
  getNextSaveQuotationNumber,
  lookupQuotation,
} = require("../utils/quotationCache");

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

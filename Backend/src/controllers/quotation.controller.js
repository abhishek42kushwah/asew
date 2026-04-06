const db = require("../config/db.config");

/**
 * GET NEXT QUOTATION NUMBER
 * Optimized to only fetch the latest rows from both 'save' and 'response' sheets.
 */
exports.getNextQuotationNumber = async (req, res) => {
  try {
    const seriesPrefix = "2026-27/QT/0";
    const fullPrefix = "2026-27/QT/";
    let maxSeq = 110; // floor → first generated number will be 0111

    // Fetch the last 100 entries from both sheets to find the latest sequence
    const [lastSaves, lastResponses] = await Promise.all([
      db.getTail("save", 100),
      db.getTail("response", 100),
    ]);

    const findMax = (rows) => {
      rows.forEach((r) => {
        const no = (r.Quotation_No || "").trim();
        if (no.startsWith(seriesPrefix)) {
          const seq = parseInt(no.replace(fullPrefix, ""), 10);
          if (!isNaN(seq) && seq > maxSeq) {
            maxSeq = seq;
          }
        }
      });
    };

    findMax(lastSaves);
    findMax(lastResponses);

    const nextSeq = maxSeq + 1;
    const nextQuotationNo = `${fullPrefix}${String(nextSeq).padStart(4, "0")}`;

    res.json({
      success: true,
      nextQuotationNo,
    });
  } catch (error) {
    console.error("[getNextQuotationNumber] Error:", error);
    res.status(500).json({
      success: false,
      message: "Error calculating next quotation number",
    });
  }
};

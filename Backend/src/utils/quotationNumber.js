const SAVE_QUOTATION_PREFIX = "2026-27/QT/";
const SAVE_QUOTATION_SERIES_PREFIX = "2026-27/QT/0";
const SAVE_QUOTATION_MIN_SEQUENCE = 110;
const RESPONSE_QUOTATION_PREFIX = "2025-26/RS/";
const RESPONSE_QUOTATION_MIN_SEQUENCE = 0;

const parseQuotationSequence = (quotationNo, prefix) => {
  const value = quotationNo?.toString().trim() || "";

  if (!value.startsWith(prefix)) {
    return null;
  }

  const sequence = parseInt(value.slice(prefix.length), 10);
  return Number.isNaN(sequence) ? null : sequence;
};

const formatQuotationNumber = (prefix, sequence, padLength = 4) =>
  `${prefix}${String(sequence).padStart(padLength, "0")}`;

module.exports = {
  SAVE_QUOTATION_MIN_SEQUENCE,
  SAVE_QUOTATION_PREFIX,
  SAVE_QUOTATION_SERIES_PREFIX,
  RESPONSE_QUOTATION_MIN_SEQUENCE,
  RESPONSE_QUOTATION_PREFIX,
  formatQuotationNumber,
  parseQuotationSequence,
};

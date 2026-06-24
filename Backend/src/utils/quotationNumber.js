const SAVE_QUOTATION_PREFIX = "2026-27/QT/";
const SAVE_QUOTATION_SERIES_PREFIX = "2026-27/QT/0";
const SAVE_QUOTATION_MIN_SEQUENCE = 110;
// Ceiling for the auto-number scan. The active series is in the hundreds; a few
// real-but-out-of-band entries exist (year-like numbers e.g. 2009/2010 that were
// entered manually). Sequences above this are treated as anomalies and ignored
// when computing the next number, so numbering continues the dense series. Raise
// this if the real series ever legitimately approaches it.
const SAVE_QUOTATION_MAX_SEQUENCE = 1999;
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
  SAVE_QUOTATION_MAX_SEQUENCE,
  SAVE_QUOTATION_PREFIX,
  SAVE_QUOTATION_SERIES_PREFIX,
  RESPONSE_QUOTATION_MIN_SEQUENCE,
  RESPONSE_QUOTATION_PREFIX,
  formatQuotationNumber,
  parseQuotationSequence,
};

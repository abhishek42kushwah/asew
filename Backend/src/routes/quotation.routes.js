const express = require("express");
const router = express.Router();
const quotationController = require("../controllers/quotation.controller");

router.get("/lookup", quotationController.lookupQuotation);
router.get("/next-number", quotationController.getNextQuotationNumber);

module.exports = router;

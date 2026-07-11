const express = require("express");
const router = express.Router();
const quotationController = require("../controllers/quotation.controller");

router.get("/lookup", quotationController.lookupQuotation);
router.get("/next-number", quotationController.getNextQuotationNumber);
router.get("/db-health", quotationController.getDbHealth);
router.post("/pdf-session", quotationController.createPdfSession);
router.post("/pdf-finalize", quotationController.finalizePdf);

module.exports = router;

const express = require("express");

const router = express.Router();

const saveController = require("../controllers/save.controller");

const multer = require("multer");

const storage = multer.memoryStorage();

const upload = multer({ storage });

router.post(
  "/",
  upload.fields([
    { name: "Image_URL", maxCount: 10 },
    { name: "Generated_PDF", maxCount: 1 }
  ]),
  saveController.createSave
);

router.get("/", saveController.getAllSave);

router.get("/:quotationNo", saveController.getSaveSingle);

module.exports = router;
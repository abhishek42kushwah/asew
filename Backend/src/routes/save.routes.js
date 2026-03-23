const express = require("express");

const router = express.Router();

const saveController = require("../controllers/save.controller");

const multer = require("multer");

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fieldSize: 10 * 1024 * 1024, // 10MB
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

router.post(
  "/",
  upload.fields([
    { name: "Image_URL", maxCount: 200 },
    { name: "Generated_PDF", maxCount: 1 },
  ]),
  saveController.createSave,
);

router.get("/", saveController.getAllSave);

module.exports = router;

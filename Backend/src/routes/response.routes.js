const express = require("express");

const router = express.Router();

const responseController = require("../controllers/response.controller");

const multer = require("multer");

const storage = multer.memoryStorage();

const upload = multer({ storage });

router.post(
  "/",
  upload.fields([
    { name: "Image_URL", maxCount: 10 },
    { name: "Generated_PDF", maxCount: 1 },
  ]),
  responseController.createResponse,
);

router.get("/", responseController.getAllResponse);

module.exports = router;

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

// Wrap multer so its errors (too many images / file too large) return a clear
// 413 instead of an opaque 500 from the global handler.
const uploadAssets = (req, res, next) => {
  upload.fields([
    { name: "Image_URL", maxCount: 2000 },
    { name: "Generated_PDF", maxCount: 1 },
  ])(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      const message =
        err.code === "LIMIT_FILE_COUNT"
          ? "Too many images in one quotation"
          : err.code === "LIMIT_FILE_SIZE"
            ? "A file is too large to attach"
            : `Upload error: ${err.code}`;
      return res.status(413).json({ success: false, message });
    }
    if (err) {
      return next(err);
    }
    next();
  });
};

router.post("/", uploadAssets, saveController.createSave);

router.get("/", saveController.getAllSave);

module.exports = router;

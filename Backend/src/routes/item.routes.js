const express = require("express");
const router = express.Router();

const itemController = require("../controllers/itemMaster.controller");

router.post("/", itemController.createItem);

router.get("/", itemController.getItems);
router.put("/", itemController.updateItem);
router.put("/bulk", itemController.bulkUpdateItems);

module.exports = router;

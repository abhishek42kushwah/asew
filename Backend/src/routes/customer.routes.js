const express = require("express");
const router = express.Router();

const customerController = require("../controllers/customer.controller");

router.post("/", customerController.createCustomer);

router.get("/", customerController.getCustomers);
router.put("/", customerController.updateCustomer);
module.exports = router;

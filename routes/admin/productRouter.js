const express = require("express");
const router = express.Router();
const productController = require("../../controllers/admin/productController");

// Get all products
router.get("/", productController.getAll);

// Get product by ID
router.get("/:id", productController.getById);

module.exports = router;

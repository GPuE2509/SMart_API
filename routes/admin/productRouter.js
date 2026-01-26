const express = require("express");
const router = express.Router();
const productController = require("../../controllers/admin/productController");

/**
 * Product Management Routes
 * Base path: /api/v1/products
 */

// Get all products with filters, search, and pagination
// GET /api/v1/products?search=xxx&category_id=xxx&min_price=100&max_price=1000&sort_by=name&page=1&limit=20
router.get("/", productController.getAll);

// Get product by ID
// GET /api/v1/products/:id
router.get("/:id", productController.getById);

// Create new product
// POST /api/v1/products/create
router.post("/create", productController.create);

// Update product
// PUT /api/v1/products/:id
router.put("/:id", productController.update);

// Delete product (soft delete)
// DELETE /api/v1/products/:id
router.delete("/:id", productController.delete);

module.exports = router;

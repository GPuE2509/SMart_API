const express = require("express");
const router = express.Router();
const productController = require("../../controllers/customer/productController");

/**
 * Customer Product Routes
 * Base path: /api/v1/customer/products
 * No authentication required for browsing
 */

// Get featured products (must be before /:id)
router.get("/featured/list", productController.getFeatured);

// Get all products with filters
router.get("/", productController.getAll);

// Get product by ID with full details
router.get("/:id", productController.getById);

// Get related products
router.get("/:id/related", productController.getRelated);

module.exports = router;

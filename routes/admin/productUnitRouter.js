const express = require("express");
const router = express.Router();
const productUnitController = require("../../controllers/admin/productUnitController");

/**
 * Product Unit Routes
 * Base path: /api/v1/product-units
 */

// Utility endpoints (must be before /:id to avoid conflicts)
router.get("/stats/overview", productUnitController.getStats);
router.post("/generate-barcode", productUnitController.generateBarcode);
router.post("/validate-barcode", productUnitController.validateBarcode);

// Unit management endpoints (merged from unitRouter)
router.get("/units", productUnitController.getAllUnits);
router.post("/units", productUnitController.createUnit);
router.get("/units/:id", productUnitController.getUnitById);
router.put("/units/:id", productUnitController.updateUnit);
router.delete("/units/:id", productUnitController.deleteUnit);

// Get product units by product ID
router.get("/product/:productId", productUnitController.getByProductId);

// Get all product units with filters
router.get("/", productUnitController.getAll);

// Get single product unit by ID
router.get("/:id", productUnitController.getById);

// Create new product unit
router.post("/", productUnitController.create);

// Update product unit
router.put("/:id", productUnitController.update);

// Delete product unit
router.delete("/:id", productUnitController.delete);

module.exports = router;

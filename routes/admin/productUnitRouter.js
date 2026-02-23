const express = require("express");
const router = express.Router();
const productUnitController = require("../../controllers/admin/productUnitController");
const {
  authenticateUser,
  authorizeRoles,
} = require("../../middleware/authMiddleware");
/**
 * Product Unit Routes
 * Base path: /api/v1/product-units
 */

// Utility endpoints (must be before /:id to avoid conflicts)
router.get(
  "/stats/overview",
  authenticateUser,
  authorizeRoles("admin"),
  productUnitController.getStats,
);
router.post(
  "/generate-barcode",
  authenticateUser,
  authorizeRoles("admin"),
  productUnitController.generateBarcode,
);
router.post(
  "/validate-barcode",
  authenticateUser,
  authorizeRoles("admin"),
  productUnitController.validateBarcode,
);

// Unit management endpoints (merged from unitRouter)
router.get(
  "/units",
  authenticateUser,
  authorizeRoles("admin", "repository_staff"),
  productUnitController.getAllUnits,
);
router.post(
  "/units",
  authenticateUser,
  authorizeRoles("admin"),
  productUnitController.createUnit,
);
router.get(
  "/units/:id",
  authenticateUser,
  authorizeRoles("admin", "repository_staff"),
  productUnitController.getUnitById,
);
router.put(
  "/units/:id",
  authenticateUser,
  authorizeRoles("admin"),
  productUnitController.updateUnit,
);
router.delete(
  "/units/:id",
  authenticateUser,
  authorizeRoles("admin"),
  productUnitController.deleteUnit,
);

// Get product units by product ID
router.get(
  "/product/:productId",
  authenticateUser,
  authorizeRoles("admin", "repository_staff"),
  productUnitController.getByProductId,
);

// Get all product units with filters
router.get(
  "/",
  authenticateUser,
  authorizeRoles("admin", "repository_staff"),
  productUnitController.getAll,
);

// Get single product unit by ID
router.get(
  "/:id",
  authenticateUser,
  authorizeRoles("admin", "repository_staff"),
  productUnitController.getById,
);

// Create new product unit
router.post(
  "/",
  authenticateUser,
  authorizeRoles("admin"),
  productUnitController.create,
);

// Update product unit
router.put(
  "/:id",
  authenticateUser,
  authorizeRoles("admin"),
  productUnitController.update,
);

// Delete product unit
router.delete(
  "/:id",
  authenticateUser,
  authorizeRoles("admin"),
  productUnitController.delete,
);

module.exports = router;

const express = require("express");
const router = express.Router();
const productBatchController = require("../../controllers/repository_staff/productBatchController");
const {
  authenticateUser,
  authorizeRoles,
  requireStaffCheckIn,
} = require("../../middleware/authMiddleware");

router.use(authenticateUser);
router.use(authorizeRoles("repository_staff"));
router.use(requireStaffCheckIn);

// Get smart replenishment suggestions (must be before /:id routes)
router.get(
  "/suggestions/smart",
  productBatchController.getSmartSuggestions,
);

// Get all batches with filters and pagination
router.get(
  "/",
  productBatchController.getAll,
);

// Get batch by ID with inventory logs
router.get(
  "/:id",
  productBatchController.getById,
);

// Import new batch
router.post(
  "/import",
  productBatchController.importBatch,
);

// Update batch information
router.put(
  "/:id",
  productBatchController.update,
);

// Reject (soft delete) batch
router.delete(
  "/:id/reject",
  productBatchController.reject,
);

// Change batch status
router.patch(
  "/:id/status",
  productBatchController.changeStatus,
);

// Toggle rescue pricing for a batch item
router.patch(
  "/:batchId/items/:itemId/rescue-pricing",
  productBatchController.toggleRescuePricing,
);

// Get rescue pricing information for a batch item
router.get(
  "/:batchId/items/:itemId/rescue-pricing",
  productBatchController.getRescuePricingInfo,
);

// Get print label for batch item (with rescue pricing)
router.get(
  "/:batchId/items/:itemId/label",
  productBatchController.getPrintLabel,
);

// Set manual discount percentage for a batch item
router.patch(
  "/:batchId/items/:itemId/manual-discount",
  productBatchController.setManualDiscount,
);

module.exports = router;

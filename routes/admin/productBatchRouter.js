const express = require("express");
const router = express.Router();
const productBatchController = require("../../controllers/admin/productBatchController");
const {
  authenticateUser,
  authorizeRoles,
} = require("../../middleware/authMiddleware");

// Get all batches with filters
router.get(
  "/",
  authenticateUser,
  authorizeRoles("admin", "staff"),
  productBatchController.getAll,
);

// Get batch by ID
router.get(
  "/:id",
  authenticateUser,
  authorizeRoles("admin", "staff"),
  productBatchController.getById,
);

// Get inventory logs for a batch
router.get(
  "/:id/logs",
  authenticateUser,
  authorizeRoles("admin", "staff"),
  productBatchController.getBatchLogs,
);

// Update batch status
router.patch(
  "/:id/status",
  authenticateUser,
  authorizeRoles("admin", "staff"),
  productBatchController.updateStatus,
);

// Reject batch (soft delete)
router.post(
  "/:id/reject",
  authenticateUser,
  authorizeRoles("admin", "staff"),
  productBatchController.rejectBatch,
);

module.exports = router;

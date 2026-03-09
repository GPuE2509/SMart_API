const express = require("express");
const router = express.Router();
const productBatchController = require("../../controllers/repository_staff/productBatchController");
const {
  authenticateUser,
  authorizeRoles,
} = require("../../middleware/authMiddleware");

// Get smart replenishment suggestions (must be before /:id routes)
router.get(
  "/suggestions/smart",
  authenticateUser,
  authorizeRoles("repository_staff"),
  productBatchController.getSmartSuggestions,
);

// Get all batches with filters and pagination
router.get(
  "/",
  authenticateUser,
  authorizeRoles("repository_staff"),
  productBatchController.getAll,
);

// Get batch by ID with inventory logs
router.get(
  "/:id",
  authenticateUser,
  authorizeRoles("repository_staff"),
  productBatchController.getById,
);

// Import new batch
router.post(
  "/import",
  authenticateUser,
  authorizeRoles("repository_staff"),
  productBatchController.importBatch,
);

// Update batch information
router.put(
  "/:id",
  authenticateUser,
  authorizeRoles("repository_staff"),
  productBatchController.update,
);

// Reject (soft delete) batch
router.delete(
  "/:id/reject",
  authenticateUser,
  authorizeRoles("repository_staff"),
  productBatchController.reject,
);

// Change batch status
router.patch(
  "/:id/status",
  authenticateUser,
  authorizeRoles("repository_staff"),
  productBatchController.changeStatus,
);

module.exports = router;

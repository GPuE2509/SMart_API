const express = require("express");
const router = express.Router();
const couponController = require("../../controllers/admin/couponController");
const {
  authenticateUser,
  authorizeRoles,
} = require("../../middleware/authMiddleware");

// Get all coupons
router.get(
  "/",
  authenticateUser,
  authorizeRoles("admin"),
  couponController.getAll,
);

// Get coupon by ID
router.get(
  "/:id",
  authenticateUser,
  authorizeRoles("admin"),
  couponController.getById,
);

// Create new coupon
router.post(
  "/",
  authenticateUser,
  authorizeRoles("admin"),
  couponController.create,
);

// Update coupon
router.put(
  "/:id",
  authenticateUser,
  authorizeRoles("admin"),
  couponController.update,
);

// Delete coupon
router.delete(
  "/:id",
  authenticateUser,
  authorizeRoles("admin"),
  couponController.delete,
);

module.exports = router;

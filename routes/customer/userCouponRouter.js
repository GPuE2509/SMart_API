const express = require("express");
const router = express.Router();
const userCouponController = require("../../controllers/customer/userCouponController");
const {
  authenticateUser,
  authorizeRoles,
} = require("../../middleware/authMiddleware");

/**
 * Customer User Coupon Routes (wallet)
 * Base path: /api/v1/customer/user-coupons
 */

// Get all coupons in current user's wallet
router.get(
  "/",
  authenticateUser,
  authorizeRoles("customer"),
  userCouponController.getMyCoupons,
);

// Purchase a coupon using loyalty points
router.post(
  "/purchase",
  authenticateUser,
  authorizeRoles("customer"),
  userCouponController.purchase,
);

// Validate a coupon for checkout
router.post(
  "/validate",
  authenticateUser,
  authorizeRoles("customer"),
  userCouponController.validateCoupon,
);

module.exports = router;


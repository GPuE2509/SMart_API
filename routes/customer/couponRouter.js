const express = require("express");
const router = express.Router();
const couponController = require("../../controllers/customer/couponController");

/**
 * Customer Coupon Routes
 * Base path: /api/v1/customer/coupons
 * No authentication required for browsing available coupons
 */

// Get all currently available coupons
router.get("/available", couponController.getAvailable);

module.exports = router;


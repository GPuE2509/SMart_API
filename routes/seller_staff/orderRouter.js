const express = require("express");
const router = express.Router();
const orderController = require("../../controllers/seller_staff/orderController");
const {
  authenticateUser,
  authorizeRoles,
  requireStaffCheckIn,
} = require("../../middleware/authMiddleware");

// All routes require authentication and seller_staff role
router.use(authenticateUser);
router.use(authorizeRoles("seller_staff", "admin"));
router.use(requireStaffCheckIn);

// GET /api/v1/seller-staff/orders/stats - Get order statistics (must be before /:orderId)
router.get("/stats", orderController.getOrderStats);

// GET /api/v1/seller-staff/orders/scan/:barcode - Search by barcode (must be before /:orderId)
router.get("/scan/:barcode", orderController.searchByBarcode);

// GET /api/v1/seller-staff/orders - Get order list with filters
router.get("/", orderController.getOrderList);

// GET /api/v1/seller-staff/orders/:orderId - Get order detail
router.get("/:orderId", orderController.getOrderDetail);

module.exports = router;

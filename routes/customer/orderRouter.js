const express = require("express");
const router = express.Router();
const orderController = require("../../controllers/customer/orderController");
const { authenticateUser } = require("../../middleware/authMiddleware");

// Search/filter products in cart
router.get("/cart/search", authenticateUser, orderController.searchCart);

// Create new order
router.post("/", authenticateUser, orderController.createOrder);

// Create PayOS payment link
router.post(
  "/payos/create-payment",
  authenticateUser,
  orderController.createPayOSPayment,
);

// Get user orders
router.get("/", authenticateUser, orderController.getUserOrders);

// Get order by ID
router.get("/:orderId", authenticateUser, orderController.getOrderById);

// Check payment status
router.get(
  "/:orderId/payment-status",
  authenticateUser,
  orderController.checkPaymentStatus,
);

// PayOS webhook (no auth required - called by PayOS)
router.post("/payos/webhook", orderController.handlePayOSWebhook);

module.exports = router;

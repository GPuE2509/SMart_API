const express = require("express");
const router = express.Router();
const posController = require("../../controllers/seller_staff/posController");
const {
  authenticateUser,
  authorizeRoles,
} = require("../../middleware/authMiddleware");

router.post(
  "/transactions",
  authenticateUser,
  authorizeRoles("seller_staff"),
  posController.createTransaction,
);

router.get(
  "/transactions/open",
  authenticateUser,
  authorizeRoles("seller_staff"),
  posController.getOpenTransactions,
);

router.get(
  "/products",
  authenticateUser,
  authorizeRoles("seller_staff"),
  posController.getProductList,
);

router.get(
  "/categories",
  authenticateUser,
  authorizeRoles("seller_staff"),
  posController.getCategories,
);

router.post(
  "/customers/resolve-qr",
  authenticateUser,
  authorizeRoles("seller_staff"),
  posController.resolveCustomerByQr,
);

router.get(
  "/customers/search",
  authenticateUser,
  authorizeRoles("seller_staff"),
  posController.searchCustomers,
);

router.get(
  "/transactions/:transactionId",
  authenticateUser,
  authorizeRoles("seller_staff"),
  posController.getTransactionDetail,
);

router.post(
  "/transactions/:transactionId/hold",
  authenticateUser,
  authorizeRoles("seller_staff"),
  posController.holdTransaction,
);

router.post(
  "/transactions/:transactionId/resume",
  authenticateUser,
  authorizeRoles("seller_staff"),
  posController.resumeTransaction,
);

router.patch(
  "/transactions/:transactionId/customer",
  authenticateUser,
  authorizeRoles("seller_staff"),
  posController.assignCustomer,
);

router.get(
  "/transactions/:transactionId/customer-coupons",
  authenticateUser,
  authorizeRoles("seller_staff"),
  posController.getCustomerCoupons,
);

router.post(
  "/transactions/:transactionId/customer-coupons/redeem",
  authenticateUser,
  authorizeRoles("seller_staff"),
  posController.redeemCustomerCoupon,
);

router.post(
  "/transactions/:transactionId/coupon/apply",
  authenticateUser,
  authorizeRoles("seller_staff"),
  posController.applyCoupon,
);

router.delete(
  "/transactions/:transactionId/coupon",
  authenticateUser,
  authorizeRoles("seller_staff"),
  posController.removeCoupon,
);

router.post(
  "/transactions/:transactionId/items",
  authenticateUser,
  authorizeRoles("seller_staff"),
  posController.addItem,
);

router.delete(
  "/transactions/:transactionId/items/:itemId",
  authenticateUser,
  authorizeRoles("seller_staff"),
  posController.removeItem,
);

router.patch(
  "/transactions/:transactionId/items/:itemId",
  authenticateUser,
  authorizeRoles("seller_staff"),
  posController.updateItem,
);

router.post(
  "/transactions/:transactionId/payos/create-payment",
  authenticateUser,
  authorizeRoles("seller_staff"),
  posController.createPayOSPayment,
);

router.post(
  "/transactions/:transactionId/complete-cash",
  authenticateUser,
  authorizeRoles("seller_staff"),
  posController.completeCashPayment,
);

router.post(
  "/transactions/:transactionId/complete-cod",
  authenticateUser,
  authorizeRoles("seller_staff"),
  posController.completeCodPayment,
);

router.get(
  "/transactions/:transactionId/payment-status",
  authenticateUser,
  authorizeRoles("seller_staff"),
  posController.checkPaymentStatus,
);

router.delete(
  "/transactions/:transactionId",
  authenticateUser,
  authorizeRoles("seller_staff"),
  posController.deleteTransaction,
);

router.post(
  "/transactions/:transactionId/issue-receipt",
  authenticateUser,
  authorizeRoles("seller_staff"),
  posController.issueReceipt,
);

module.exports = router;

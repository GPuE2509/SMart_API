const express = require("express");
const router = express.Router();
const posController = require("../../controllers/seller_staff/posController");
const {
  authenticateUser,
  authorizeRoles,
  requireStaffCheckIn,
} = require("../../middleware/authMiddleware");

router.use(authenticateUser);
router.use(authorizeRoles("seller_staff"));
router.use(requireStaffCheckIn);

router.post(
  "/transactions",
  posController.createTransaction,
);

router.get(
  "/transactions/open",
  posController.getOpenTransactions,
);

router.get(
  "/products",
  posController.getProductList,
);

router.get(
  "/categories",
  posController.getCategories,
);

router.post(
  "/customers/resolve-qr",
  posController.resolveCustomerByQr,
);

router.get(
  "/customers/search",
  posController.searchCustomers,
);

router.get(
  "/transactions/:transactionId",
  posController.getTransactionDetail,
);

router.post(
  "/transactions/:transactionId/hold",
  posController.holdTransaction,
);

router.post(
  "/transactions/:transactionId/resume",
  posController.resumeTransaction,
);

router.patch(
  "/transactions/:transactionId/customer",
  posController.assignCustomer,
);

router.get(
  "/transactions/:transactionId/customer-coupons",
  posController.getCustomerCoupons,
);

router.post(
  "/transactions/:transactionId/customer-coupons/redeem",
  posController.redeemCustomerCoupon,
);

router.post(
  "/transactions/:transactionId/coupon/apply",
  posController.applyCoupon,
);

router.delete(
  "/transactions/:transactionId/coupon",
  posController.removeCoupon,
);

router.post(
  "/transactions/:transactionId/items",
  posController.addItem,
);

router.post(
  "/transactions/:transactionId/items/scan-barcode",
  posController.addItemByBarcode,
);

router.delete(
  "/transactions/:transactionId/items/:itemId",
  posController.removeItem,
);

router.patch(
  "/transactions/:transactionId/items/:itemId",
  posController.updateItem,
);

router.post(
  "/transactions/:transactionId/payos/create-payment",
  posController.createPayOSPayment,
);

router.post(
  "/transactions/:transactionId/complete-cash",
  posController.completeCashPayment,
);

router.post(
  "/transactions/:transactionId/complete-cod",
  posController.completeCodPayment,
);

router.get(
  "/transactions/:transactionId/payment-status",
  posController.checkPaymentStatus,
);

router.delete(
  "/transactions/:transactionId",
  posController.deleteTransaction,
);

router.post(
  "/transactions/:transactionId/issue-receipt",
  posController.issueReceipt,
);

module.exports = router;

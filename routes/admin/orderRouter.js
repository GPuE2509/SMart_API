const express = require("express");
const router = express.Router();
const orderController = require("../../controllers/admin/orderController");
const {
  authenticateUser,
  authorizeRoles,
} = require("../../middleware/authMiddleware");

router.get("/", authenticateUser, authorizeRoles("admin"), orderController.getAll);
router.patch(
  "/:id/confirm-payment",
  authenticateUser,
  authorizeRoles("admin"),
  orderController.confirmPayment,
);

module.exports = router;

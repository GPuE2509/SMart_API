const express = require("express");
const router = express.Router();
const productController = require("../../controllers/admin/productController");
const {
  authenticateUser,
  authorizeRoles,
} = require("../../middleware/authMiddleware");

router.get(
  "/",
  authenticateUser,
  authorizeRoles("admin", "repository_staff"),
  productController.getAll,
);

router.get(
  "/:id",
  authenticateUser,
  authorizeRoles("admin", "repository_staff"),
  productController.getById,
);

router.post(
  "/create",
  authenticateUser,
  authorizeRoles("admin"),
  productController.create,
);

router.put(
  "/:id",
  authenticateUser,
  authorizeRoles("admin"),
  productController.update,
);

router.delete(
  "/:id",
  authenticateUser,
  authorizeRoles("admin"),
  productController.delete,
);

module.exports = router;

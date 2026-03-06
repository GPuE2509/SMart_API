const express = require("express");
const router = express.Router();
const userController = require("../../controllers/admin/userController");
const {
  authenticateUser,
  authorizeRoles,
} = require("../../middleware/authMiddleware");

// Get current user profile
router.get("/profile/me", authenticateUser, userController.getMyProfile);

// Update current user profile
router.put("/profile/me", authenticateUser, userController.updateMyProfile);

// Get all users with filters and pagination
router.get(
  "/",
  authenticateUser,
  authorizeRoles("admin"),
  userController.getAll,
);

// Get user by ID
router.get(
  "/:id",
  authenticateUser,
  authorizeRoles("admin"),
  userController.getById,
);

// Create new staff/admin account
router.post(
  "/create-staff",
  authenticateUser,
  authorizeRoles("admin"),
  userController.createStaffAccount,
);

// Update user information
router.put(
  "/:id",
  authenticateUser,
  authorizeRoles("admin"),
  userController.update,
);

// Update user status (block/unblock)
router.put(
  "/:id/status",
  authenticateUser,
  authorizeRoles("admin"),
  userController.updateStatus,
);

// Update user role
router.put(
  "/:id/role",
  authenticateUser,
  authorizeRoles("admin"),
  userController.updateRole,
);

// Update user's face data (descriptor and image)
router.patch(
  "/:id/face-data",
  authenticateUser,
  userController.updateUserFaceData,
);

module.exports = router;

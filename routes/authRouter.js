const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const {
  authenticateUser,
  authorizeRoles,
} = require("../middleware/authMiddleware");
const passport = require("../config/passport");

router.post('/signup', authController.signup);
router.post('/signin', authController.signin);
router.post('/verify-otp', authController.verifyOTP);
router.post('/resend-otp', authController.resendOTP);
router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-password-reset-otp', authController.verifyPasswordResetOTP);
router.post('/reset-password', authController.resetPassword);
router.post('/change-password', authenticateUser, authController.changePassword);

// Get current user & logout
router.get('/me', authenticateUser, authController.me);
router.post('/logout', authenticateUser,authController.logout);

// Staff/Admin Login with Email Verification
router.post("/staff-admin-login", authController.staffAdminLogin);
router.get("/verify-login", authController.verifyStaffAdminLogin);

// Google OAuth routes
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  }),
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/api/v1/auth/google/error",
    session: false,
  }),
  authController.googleCallback,
);

router.get("/google/error", authController.googleAuthError);

module.exports = router;

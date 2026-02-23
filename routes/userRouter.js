const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateUser, authorizeRoles } = require('../middleware/authMiddleware');

// User profile routes (requires authentication)
router.get('/profile/me', authenticateUser, userController.getMyProfile);
router.put('/profile/me', authenticateUser, userController.updateMyProfile);
router.post('/profile/avatar', authenticateUser, userController.uploadAvatar);

// Admin routes - User management
router.get(
    '/',
    authenticateUser,
    authorizeRoles('admin'),
    userController.getAllUsers
);

router.get(
    '/:userId',
    authenticateUser,
    authorizeRoles('admin'),
    userController.getUserProfile
);

router.put(
    '/:userId',
    authenticateUser,
    authorizeRoles('admin'),
    userController.updateUserProfile
);

router.put(
    '/:userId/status',
    authenticateUser,
    authorizeRoles('admin'),
    userController.updateUserStatus
);

router.put(
    '/:userId/role',
    authenticateUser,
    authorizeRoles('admin'),
    userController.updateUserRole
);

router.delete(
    '/:userId',
    authenticateUser,
    authorizeRoles('admin'),
    userController.deleteUser
);

module.exports = router;

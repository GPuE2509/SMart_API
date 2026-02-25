const express = require('express');
const router = express.Router();
const attendanceController = require('../../controllers/admin/attendanceController');
const { verifyToken, isAdmin, isStaff } = require('../../middleware/authMiddleware');

// Admin routes - require admin authentication
router.post('/register-face', verifyToken, isAdmin, attendanceController.registerStaffFace);
router.get('/all', verifyToken, isAdmin, attendanceController.getAllStaffAttendance);
router.get('/staff-with-face', verifyToken, isAdmin, attendanceController.getAllStaffWithFace);

// Staff routes - require staff authentication
router.post('/check-in', verifyToken, isStaff, attendanceController.checkIn);
router.post('/check-out', verifyToken, isStaff, attendanceController.checkOut);
router.get('/history/:userId', verifyToken, attendanceController.getAttendanceHistory);
router.get('/face-data/:userId', verifyToken, attendanceController.getStaffFaceData);

module.exports = router;

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const StaffAttendance = require('../models/StaffAttendance');

const authenticateUser = async (req, res, next) => {
    // Get token from HTTP-only cookie first, fallback to Authorization header for backwards compatibility
    const token = req.cookies.token || req.header('Authorization')?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Truy cập bị từ chối. Không có token được cung cấp.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.userId).select('-password');
        next();
    } catch (err) {
        res.status(403).json({ message: 'Token không hợp lệ.' });
    }
};

const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Yêu cầu xác thực.' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ 
                message: `Truy cập bị từ chối, yêu cầu quyền: ${roles.join(', ')}` 
            });
        }

        next();
    };
};

// Alias for consistency
const verifyToken = authenticateUser;

// Helper middleware for admin role
const isAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Yêu cầu xác thực.' });
    }
    
    if (req.user.role !== 'admin') {
        return res.status(403).json({ 
            message: 'Truy cập bị từ chối. Chỉ admin mới có quyền.' 
        });
    }
    
    next();
};

// Helper middleware for staff roles (seller_staff and repository_staff)
const isStaff = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Yêu cầu xác thực.' });
    }
    
    if (!['seller_staff', 'repository_staff'].includes(req.user.role)) {
        return res.status(403).json({ 
            message: 'Truy cập bị từ chối. Chỉ nhân viên mới có quyền.' 
        });
    }
    
    next();
};

// Require active check-in for seller_staff and repository_staff before accessing feature routes
const requireStaffCheckIn = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Yeu cau xac thuc.' });
    }

    if (!['seller_staff', 'repository_staff'].includes(req.user.role)) {
        return next();
    }

    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const activeAttendance = await StaffAttendance.findOne({
            user_id: req.user._id,
            check_in_time: { $gte: today, $lt: tomorrow },
            status: 'checked_in'
        }).select('_id');

        if (!activeAttendance) {
            return res.status(403).json({
                code: 'STAFF_NOT_CHECKED_IN',
                message: 'Ban chua check-in. Vui long check-in de su dung cac chuc nang.'
            });
        }

        next();
    } catch (err) {
        return res.status(500).json({ message: 'Loi kiem tra trang thai check-in.' });
    }
};

module.exports = {
    authenticateUser,
    authorizeRoles,
    verifyToken,
    isAdmin,
    isStaff,
    requireStaffCheckIn
};
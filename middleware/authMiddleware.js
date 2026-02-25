const jwt = require('jsonwebtoken');
const User = require('../models/User');

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

module.exports = {
    authenticateUser,
    authorizeRoles,
    verifyToken,
    isAdmin,
    isStaff
};
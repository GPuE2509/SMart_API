const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticateUser = async (req, res, next) => {
    // Get token from HTTP-only cookie first, fallback to Authorization header for backwards compatibility
    const token = req.cookies.token || req.header('Authorization')?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access Denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.userId).select('-password');
        next();
    } catch (err) {
        res.status(403).json({ message: 'Invalid token.' });
    }
};


module.exports = {
    authenticateUser
};
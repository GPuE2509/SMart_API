const authService = require('../services/authService');
const jwt = require('jsonwebtoken');

const mongoose = require('mongoose');

exports.signin = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: 'Email và mật khẩu là bắt buộc'
            });
        }

        const result = await authService.signin(email, password);

        // Set HTTP-only cookie
        res.cookie('token', result.token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 6 * 60 * 60 * 1000 // 6 hours
        });

        res.status(200).json({
            message: 'Đăng nhập thành công',
            user: result.user
        });
    } catch (error) {
        if (error.message === 'Email hoặc mật khẩu không đúng') {
            return res.status(401).json({
                error: error.message
            });
        }
        res.status(500).json({
            message: 'Đăng nhập thất bại',
            error: error.message
        });
    }
};

exports.signup = async (req, res) => {
    try {
        const { full_name, email, password, phone } = req.body;

        if (!email || !password || !phone || !full_name) {
            return res.status(400).json({
                message: 'Họ tên, số điện thoại, email và mật khẩu là bắt buộc'
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                message: 'Vui lòng cung cấp địa chỉ email hợp lệ'
            });
        }

        // Validate Vietnamese phone number (10 digits, starts with 03, 05, 07, 08, 09)
        const phoneRegex = /^(0[3|5|7|8|9])+([0-9]{8})$/;
        if (!phoneRegex.test(phone)) {
            return res.status(400).json({
                message: 'Số điện thoại không hợp lệ'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                message: 'Mật khẩu phải có ít nhất 6 ký tự'
            });
        }

        const user = await authService.signup({ full_name, email, password, phone });

        res.status(201).json({
            message: 'Đăng ký thành công. Vui lòng kiểm tra email để lấy mã OTP xác thực.',
            userId: user
        });
    } catch (error) {
        if (error.message === 'Email đã tồn tại') {
            return res.status(409).json({
                error: 'Email đã được sử dụng và đã xác thực'
            });
        }
        if (error.message.includes('Không thể gửi email')) {
            return res.status(500).json({
                message: 'Đăng ký thành công nhưng không thể gửi email OTP. Vui lòng yêu cầu gửi lại OTP.',
                error: error.message
            });
        }
        res.status(500).json({
            message: 'Đăng ký người dùng thất bại',
            error: error.message
        });
    }
};

// Verify OTP
exports.verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                message: 'Email và mã OTP là bắt buộc'
            });
        }

        const result = await authService.verifyOTP(email, otp);

        res.status(200).json({
            message: result.message,
            userId: result.userId
        });
    } catch (error) {
        if (error.message === 'Không tìm thấy tài khoản với email này') {
            return res.status(404).json({
                error: error.message
            });
        }
        if (error.message === 'Mã OTP không đúng') {
            return res.status(400).json({
                error: error.message
            });
        }
        if (error.message.includes('hết hạn') || error.message.includes('Không tìm thấy mã OTP')) {
            return res.status(400).json({
                error: error.message
            });
        }
        if (error.message === 'Tài khoản đã được xác thực trước đó') {
            return res.status(400).json({
                error: error.message
            });
        }
        res.status(500).json({
            message: 'Xác thực OTP thất bại',
            error: error.message
        });
    }
};

// Resend OTP
exports.resendOTP = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                message: 'Email là bắt buộc'
            });
        }

        const result = await authService.resendOTP(email);

        res.status(200).json({
            message: result.message,
            userId: result.userId
        });
    } catch (error) {
        if (error.message === 'Không tìm thấy tài khoản với email này') {
            return res.status(404).json({
                error: error.message
            });
        }
        if (error.message === 'Tài khoản đã được xác thực') {
            return res.status(400).json({
                error: error.message
            });
        }
        if (error.message.includes('Không thể gửi email')) {
            return res.status(500).json({
                error: error.message
            });
        }
        res.status(500).json({
            message: 'Gửi lại OTP thất bại',
            error: error.message
        });
    }
};

// Forgot Password - Send OTP
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                message: 'Email là bắt buộc'
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                message: 'Vui lòng cung cấp địa chỉ email hợp lệ'
            });
        }

        const result = await authService.forgotPassword(email);

        res.status(200).json({
            message: result.message,
            userId: result.userId
        });
    } catch (error) {
        if (error.message === 'Không tìm thấy tài khoản với email này') {
            return res.status(404).json({
                error: error.message
            });
        }
        if (error.message.includes('chưa được xác thực')) {
            return res.status(400).json({
                error: error.message
            });
        }
        if (error.message.includes('Không thể gửi email')) {
            return res.status(500).json({
                error: error.message
            });
        }
        res.status(500).json({
            message: 'Gửi OTP đặt lại mật khẩu thất bại',
            error: error.message
        });
    }
};

// Verify Password Reset OTP
exports.verifyPasswordResetOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                message: 'Email và mã OTP là bắt buộc'
            });
        }

        const result = await authService.verifyPasswordResetOTP(email, otp);

        res.status(200).json({
            message: result.message,
            userId: result.userId
        });
    } catch (error) {
        if (error.message === 'Không tìm thấy tài khoản với email này') {
            return res.status(404).json({
                error: error.message
            });
        }
        if (error.message === 'Tài khoản chưa được xác thực email' ||
            error.message === 'Không tìm thấy mã OTP hoặc OTP đã hết hạn' ||
            error.message === 'Mã OTP không đúng') {
            return res.status(400).json({
                error: error.message
            });
        }
        res.status(500).json({
            message: 'Xác thực OTP thất bại',
            error: error.message
        });
    }
};

// Reset Password with OTP
exports.resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        if (!email || !otp || !newPassword) {
            return res.status(400).json({
                message: 'Email, mã OTP và mật khẩu mới là bắt buộc'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                message: 'Mật khẩu phải có ít nhất 6 ký tự'
            });
        }

        const result = await authService.resetPassword(email, otp, newPassword);

        res.status(200).json({
            message: result.message,
            userId: result.userId
        });
    } catch (error) {
        if (error.message === 'Không tìm thấy tài khoản với email này') {
            return res.status(404).json({
                error: error.message
            });
        }
        if (error.message === 'Mã OTP không đúng') {
            return res.status(400).json({
                error: error.message
            });
        }
        if (error.message.includes('hết hạn') || error.message.includes('Không tìm thấy mã OTP')) {
            return res.status(400).json({
                error: error.message
            });
        }
        if (error.message.includes('chưa được xác thực')) {
            return res.status(400).json({
                error: error.message
            });
        }
        res.status(500).json({
            message: 'Đặt lại mật khẩu thất bại',
            error: error.message
        });
    }
};

// Change Password (for logged in users)
exports.changePassword = async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            return res.status(400).json({
                message: 'Mật khẩu cũ và mật khẩu mới là bắt buộc'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                message: 'Mật khẩu mới phải có ít nhất 6 ký tự'
            });
        }

        // req.user is set by authMiddleware
        const userId = req.user._id;

        const result = await authService.changePassword(userId, oldPassword, newPassword);

        res.status(200).json({
            message: result.message
        });
    } catch (error) {
        if (error.message === 'Mật khẩu cũ không đúng') {
            return res.status(400).json({
                error: error.message
            });
        }
        if (error.message === 'Mật khẩu mới không được trùng với mật khẩu cũ') {
            return res.status(400).json({
                error: error.message
            });
        }
        if (error.message === 'Không tìm thấy tài khoản') {
            return res.status(404).json({
                error: error.message
            });
        }
        res.status(500).json({
            message: 'Đổi mật khẩu thất bại',
            error: error.message
        });
    }
};

// Google OAuth Callback
exports.googleCallback = async (req, res) => {
    try {
        // User is authenticated by passport, available in req.user
        const user = req.user;

        // Generate JWT token
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
            expiresIn: '6h'
        });

        // Return token and user info
        const userResponse = user.toObject();
        delete userResponse.password;

        // Set HTTP-only cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 6 * 60 * 60 * 1000 // 6 hours
        });

        // Send response - you can redirect or return JSON based on your frontend
        res.status(200).json({
            message: 'Đăng nhập Google thành công',
            user: userResponse
        });
    } catch (error) {
        res.status(500).json({
            message: 'Xác thực Google thất bại',
            error: error.message
        });
    }
};

// Google OAuth Error Handler
exports.googleAuthError = (req, res) => {
    res.status(401).json({
        message: 'Xác thực Google thất bại',
        error: 'Xác thực đã bị hủy hoặc thất bại'
    });
};

// Staff/Admin Login - Step 1: Request login verification
exports.staffAdminLogin = async (req, res) => {
    try {
        const { email, password, sessionId } = req.body;

        if (!email || !password || !sessionId) {
            return res.status(400).json({
                message: 'Email, mật khẩu và session ID là bắt buộc'
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                message: 'Vui lòng cung cấp địa chỉ email hợp lệ'
            });
        }

        const result = await authService.staffAdminLogin(email, password, sessionId);

        res.status(200).json({
            message: result.message,
            requiresEmailVerification: result.requiresEmailVerification
        });
    } catch (error) {
        if (error.message.includes('Email hoặc mật khẩu không đúng')) {
            return res.status(401).json({
                error: error.message
            });
        }
        if (error.message.includes('không có quyền truy cập')) {
            return res.status(403).json({
                error: error.message
            });
        }
        if (error.message.includes('chưa được xác thực')) {
            return res.status(400).json({
                error: error.message
            });
        }
        if (error.message.includes('bị khóa')) {
            return res.status(403).json({
                error: error.message
            });
        }
        if (error.message.includes('Không thể gửi email')) {
            return res.status(500).json({
                error: error.message
            });
        }
        res.status(500).json({
            message: 'Xử lý yêu cầu đăng nhập thất bại',
            error: error.message
        });
    }
};

// Staff/Admin Login - Step 2: Verify login from email
exports.verifyStaffAdminLogin = async (req, res) => {
    try {
        const { token, action } = req.query;

        if (!token || !action) {
            return res.status(400).json({
                message: 'Token và hành động là bắt buộc'
            });
        }

        if (action !== 'approve' && action !== 'deny') {
            return res.status(400).json({
                message: 'Hành động không hợp lệ. Phải là "approve" hoặc "deny"'
            });
        }

        const result = await authService.verifyStaffAdminLogin(token, action);

        // Return HTML response for better UX
        if (result.denied) {
            return res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Đăng nhập bị từ chối</title>
                    <style>
                        body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }
                        .container { text-align: center; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                        .icon { font-size: 64px; margin-bottom: 20px; }
                        h1 { color: #f44336; margin: 0 0 10px 0; }
                        p { color: #666; margin: 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="icon">❌</div>
                        <h1>Đăng nhập đã bị từ chối</h1>
                        <p>Nếu không phải bạn thực hiện, vui lòng đổi mật khẩu ngay.</p>
                    </div>
                </body>
                </html>
            `);
        }

        // Login approved - set HTTP-only cookie with token
        res.cookie('token', result.token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 6 * 60 * 60 * 1000 // 6 hours
        });

        return res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Đăng nhập thành công</title>
                <style>
                    body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }
                    .container { text-align: center; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .icon { font-size: 64px; margin-bottom: 20px; }
                    h1 { color: #4CAF50; margin: 0 0 10px 0; }
                    p { color: #666; margin: 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="icon">✅</div>
                    <h1>Xác thực thành công!</h1>
                    <p>Bạn có thể đóng trang này và quay lại ứng dụng.</p>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        if (error.message.includes('Token không hợp lệ') || error.message.includes('đã hết hạn')) {
            return res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Token hết hạn</title>
                    <style>
                        body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }
                        .container { text-align: center; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                        .icon { font-size: 64px; margin-bottom: 20px; }
                        h1 { color: #FF9800; margin: 0 0 10px 0; }
                        p { color: #666; margin: 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="icon">⏰</div>
                        <h1>${error.message}</h1>
                        <p>Vui lòng thử đăng nhập lại.</p>
                    </div>
                </body>
                </html>
            `);
        }

        res.status(500).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Lỗi</title>
                <style>
                    body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }
                    .container { text-align: center; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .icon { font-size: 64px; margin-bottom: 20px; }
                    h1 { color: #f44336; margin: 0 0 10px 0; }
                    p { color: #666; margin: 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="icon">⚠️</div>
                    <h1>Có lỗi xảy ra</h1>
                    <p>${error.message}</p>
                </div>
            </body>
            </html>
        `);
    }
};

// Get current user (requires authentication)
exports.me = async (req, res) => {
    try {
        // req.user is already set by authenticateUser middleware
        res.status(200).json({
            user: req.user
        });
    } catch (error) {
        res.status(500).json({
            message: 'Lỗi khi lấy thông tin người dùng',
            error: error.message
        });
    }
};

// Logout - clear token cookie
exports.logout = async (req, res) => {
    try {
        // Clear the token cookie
        res.cookie('token', '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 0 // Expire immediately
        });

        res.status(200).json({
            message: 'Đăng xuất thành công'
        });
    } catch (error) {
        res.status(500).json({
            message: 'Lỗi khi đăng xuất',
            error: error.message
        });
    }
};

/**
 * Verify account invitation token
 * GET /api/v1/auth/verify-invitation?token=xxx
 */
exports.verifyAccountInvitation = async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Token xác thực là bắt buộc'
            });
        }

        const userInfo = await authService.verifyAccountInvitationToken(token);

        res.status(200).json({
            success: true,
            message: 'Token hợp lệ',
            data: userInfo
        });
    } catch (error) {
        if (error.message.includes('Token xác thực không hợp lệ') || 
            error.message.includes('đã hết hạn')) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: 'Không thể xác thực token',
            error: error.message
        });
    }
};

/**
 * Set password for new account after email verification
 * POST /api/v1/auth/set-password
 * Body: { token, password, confirmPassword }
 */
exports.setPasswordForNewAccount = async (req, res) => {
    try {
        const { token, password, confirmPassword } = req.body;

        if (!token || !password || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Token, mật khẩu và xác nhận mật khẩu là bắt buộc'
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Mật khẩu và xác nhận mật khẩu không khớp'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Mật khẩu phải có ít nhất 6 ký tự'
            });
        }

        const result = await authService.setPasswordForNewAccount(token, password);

        // Set HTTP-only cookie with auth token
        res.cookie('token', result.token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 6 * 60 * 60 * 1000 // 6 hours
        });

        res.status(200).json({
            success: true,
            message: result.message,
            data: result.user
        });
    } catch (error) {
        if (error.message.includes('Token xác thực') || 
            error.message.includes('đã hết hạn') ||
            error.message.includes('Mật khẩu')) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }        res.status(500).json({
            success: false,
            message: 'Không thể đặt mật khẩu',
            error: error.message
        });
    }
};

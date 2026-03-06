const jwt = require('jsonwebtoken');
const users = require('../models/User');
const bcrypt = require('bcrypt');
const emailService = require('./emailService');
const crypto = require('crypto');
const { sendLoginVerification } = require('./socketService');

const hashPassword = async (password) => {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
};

const comparePassword = async (password, hashedPassword) => {
    return await bcrypt.compare(password, hashedPassword);
};

const generateToken = (user) => {
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
        expiresIn: '6h'
    });
    return token;
};

const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

exports.verifyToken = (token) => {
    return jwt.verify(token, JWT_SECRET);
};

exports.signup = async (userData) => {
    try {
        const { full_name, email, password, phone } = userData;

        // Check if user already exists
        const existingUser = await users.findOne({ email });
        if (existingUser) {
            // If user exists but not verified, resend OTP with updated info
            if (!existingUser.isVerified) {
                // Update user info
                existingUser.full_name = full_name;
                existingUser.phone = phone;

                // Hash new password
                const hashedPassword = await hashPassword(password);
                existingUser.password = hashedPassword;

                // Generate new OTP
                const otp = generateOTP();
                const otpExpiry = new Date(new Date().getTime() + 5 * 60 * 1000);

                existingUser.otp = otp;
                existingUser.otpExpiry = otpExpiry;
                existingUser.updated_at = new Date();

                await existingUser.save();

                // Resend OTP email
                await emailService.sendOTPEmail(email, otp, full_name);

                return existingUser._id;
            }

            // If user exists and already verified
            throw new Error('Email đã tồn tại');
        }

        // Hash password
        const hashedPassword = await hashPassword(password);

        // Generate OTP
        const otp = generateOTP();
        // 5 minutes from now in Vietnam timezone (UTC+7)
        const otpExpiry = new Date(new Date().getTime() + 5 * 60 * 1000);

        // Create new user
        const user = new users({
            full_name,
            email,
            password: hashedPassword,
            phone,
            otp,
            otpExpiry,
            isVerified: false,
            created_at: new Date(),
            updated_at: new Date()
        });

        const savedUser = await user.save();

        // Send OTP email
        await emailService.sendOTPEmail(email, otp, full_name);

        // Remove password from response
        const userResponse = savedUser._id
        return userResponse;
    } catch (error) {
        throw error;
    }
};

exports.signin = async (email, password) => {
    try {
        const user = await users.findOne({ email });
        if (!user) {
            throw new Error('Email hoặc mật khẩu không đúng');
        }

        // Check if user is verified
        if (!user.isVerified) {
            throw new Error('Tài khoản chưa được xác thực. Vui lòng kiểm tra email để lấy mã OTP.');
        }

        const isPasswordValid = await comparePassword(password, user.password);
        if (!isPasswordValid) {
            throw new Error('Email hoặc mật khẩu không đúng');
        }

        const token = generateToken(user);

        const userResponse = user.toObject();
        delete userResponse.password;

        return {
            token,
            user: userResponse
        };
    } catch (error) {
        throw error;
    }
};

// Verify OTP
exports.verifyOTP = async (email, otp) => {
    try {
        const user = await users.findOne({ email });

        if (!user) {
            throw new Error('Không tìm thấy tài khoản với email này');
        }

        if (user.isVerified) {
            throw new Error('Tài khoản đã được xác thực trước đó');
        }

        if (!user.otp || !user.otpExpiry) {
            throw new Error('Không tìm thấy mã OTP. Vui lòng yêu cầu gửi lại OTP');
        }

        // Check if OTP is expired - compare timestamps
        const currentTime = new Date(new Date().getTime()); // Vietnam time
        const expiryTime = new Date(user.otpExpiry);

        if (currentTime > expiryTime) {
            throw new Error('Mã OTP đã hết hạn. Vui lòng yêu cầu gửi lại OTP');
        }

        // Check if OTP matches
        if (user.otp !== otp) {
            throw new Error('Mã OTP không đúng');
        }

        // Update user as verified
        user.isVerified = true;
        user.otp = undefined;
        user.otpExpiry = undefined;
        user.updated_at = new Date();
        await user.save();

        // Send welcome email
        await emailService.sendWelcomeEmail(email, user.full_name);

        return {
            message: 'Xác thực tài khoản thành công',
            userId: user._id
        };
    } catch (error) {
        throw error;
    }
};

// Resend OTP
exports.resendOTP = async (email) => {
    try {
        const user = await users.findOne({ email });

        if (!user) {
            throw new Error('Không tìm thấy tài khoản với email này');
        }

        if (user.isVerified) {
            throw new Error('Tài khoản đã được xác thực');
        }

        // Generate new OTP
        const otp = generateOTP();
        // 5 minutes from now in Vietnam timezone (UTC+7)
        const otpExpiry = new Date(new Date().getTime() + 5 * 60 * 1000);

        user.otp = otp;
        user.otpExpiry = otpExpiry;
        user.updated_at = new Date();
        await user.save();

        // Send new OTP email
        await emailService.sendOTPEmail(email, otp, user.full_name);

        return {
            message: 'Mã OTP mới đã được gửi đến email của bạn',
            userId: user._id
        };
    } catch (error) {
        throw error;
    }
};

// Forgot Password - Send OTP
exports.forgotPassword = async (email) => {
    try {
        const user = await users.findOne({ email });

        if (!user) {
            throw new Error('Không tìm thấy tài khoản với email này');
        }

        if (!user.isVerified) {
            throw new Error('Tài khoản chưa được xác thực. Vui lòng xác thực tài khoản trước.');
        }

        // Generate OTP for password reset
        const otp = generateOTP();
        const otpExpiry = new Date(new Date().getTime() + 5 * 60 * 1000); // 5 minutes

        user.otp = otp;
        user.otpExpiry = otpExpiry;
        user.updated_at = new Date();
        await user.save();

        // Send password reset OTP email
        await emailService.sendPasswordResetOTP(email, otp, user.full_name);

        return {
            message: 'Mã OTP đặt lại mật khẩu đã được gửi đến email của bạn',
            userId: user._id
        };
    } catch (error) {
        throw error;
    }
};

// Reset Password with OTP
exports.resetPassword = async (email, otp, newPassword) => {
    try {
        const user = await users.findOne({ email });

        if (!user) {
            throw new Error('Không tìm thấy tài khoản với email này');
        }

        if (!user.isVerified) {
            throw new Error('Tài khoản chưa được xác thực');
        }

        if (!user.otp || !user.otpExpiry) {
            throw new Error('Không tìm thấy mã OTP. Vui lòng yêu cầu gửi lại OTP');
        }

        // Check if OTP is expired
        const currentTime = new Date(new Date().getTime()); // Vietnam time
        const expiryTime = new Date(user.otpExpiry);

        if (currentTime > expiryTime) {
            throw new Error('Mã OTP đã hết hạn. Vui lòng yêu cầu gửi lại OTP');
        }

        // Check if OTP matches
        if (user.otp !== otp) {
            throw new Error('Mã OTP không đúng');
        }

        // Hash new password
        const hashedPassword = await hashPassword(newPassword);

        // Update password and clear OTP
        user.password = hashedPassword;
        user.otp = undefined;
        user.otpExpiry = undefined;
        user.updated_at = new Date();
        await user.save();

        // Send password reset success email
        await emailService.sendPasswordResetSuccess(email, user.full_name);

        return {
            message: 'Mật khẩu đã được đặt lại thành công',
            userId: user._id
        };
    } catch (error) {
        throw error;
    }
};

// Verify OTP for Password Reset
exports.verifyPasswordResetOTP = async (email, otp) => {
    try {
        const user = await users.findOne({ email });

        if (!user) {
            throw new Error('Không tìm thấy tài khoản với email này');
        }

        if (!user.isVerified) {
            throw new Error('Tài khoản chưa được xác thực');
        }

        if (!user.otp || !user.otpExpiry) {
            throw new Error('Không tìm thấy mã OTP. Vui lòng yêu cầu gửi lại OTP');
        }

        // Check if OTP is expired
        const currentTime = new Date(new Date().getTime()); // Vietnam time
        const expiryTime = new Date(user.otpExpiry);

        if (currentTime > expiryTime) {
            throw new Error('Mã OTP đã hết hạn. Vui lòng yêu cầu gửi lại OTP');
        }

        // Check if OTP matches
        if (user.otp !== otp) {
            throw new Error('Mã OTP không đúng');
        }

        return {
            message: 'Mã OTP hợp lệ',
            userId: user._id
        };
    } catch (error) {
        throw error;
    }
};

// Change Password (for logged in users)
exports.changePassword = async (userId, oldPassword, newPassword) => {
    try {
        const user = await users.findById(userId);

        if (!user) {
            throw new Error('Không tìm thấy tài khoản');
        }

        // Verify old password
        const isPasswordValid = await comparePassword(oldPassword, user.password);
        if (!isPasswordValid) {
            throw new Error('Mật khẩu cũ không đúng');
        }

        // Check if new password is same as old password
        const isSamePassword = await comparePassword(newPassword, user.password);
        if (isSamePassword) {
            throw new Error('Mật khẩu mới không được trùng với mật khẩu cũ');
        }

        // Hash new password
        const hashedPassword = await hashPassword(newPassword);

        // Update password
        user.password = hashedPassword;
        user.updated_at = new Date();
        await user.save();

        return {
            message: 'Đổi mật khẩu thành công'
        };
    } catch (error) {
        throw error;
    }
};

// Staff/Admin Login - Step 1: Request login (send email)
exports.staffAdminLogin = async (email, password, sessionId) => {
    try {
        const user = await users.findOne({ email });

        if (!user) {
            throw new Error('Email hoặc mật khẩu không đúng');
        }

        // Check if user is admin or staff
        if (user.role === 'customer') {
            throw new Error('Tài khoản này không có quyền truy cập vào hệ thống quản lý');
        }

        // Check if user is verified
        if (!user.isVerified) {
            throw new Error('Tài khoản chưa được xác thực. Vui lòng kiểm tra email để lấy mã OTP.');
        }

        // Check if user is blocked
        if (user.status === 'blocked') {
            throw new Error('Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.');
        }

        // Verify password
        const isPasswordValid = await comparePassword(password, user.password);
        if (!isPasswordValid) {
            throw new Error('Email hoặc mật khẩu không đúng');
        }

        // Generate login token
        const loginToken = crypto.randomBytes(32).toString('hex');
        const loginTokenExpiry = new Date(new Date().getTime() + 5 * 60 * 1000); // 5 minutes
        const now = new Date();

        console.log("Raw:", now);
        console.log("toISOString:", now.toISOString());
        console.log("toString:", now.toString());
        console.log("toLocaleString:", now.toLocaleString());
        console.log(Intl.DateTimeFormat().resolvedOptions().timeZone);

        // Save login token and sessionId
        user.loginToken = loginToken;
        user.loginTokenExpiry = loginTokenExpiry;
        user.loginSessionId = sessionId;
        user.updated_at = new Date();
        await user.save();

        // Send verification email
        await emailService.sendLoginVerification(email, user.full_name, user.role, loginToken);

        // Send socket notification to frontend
        sendLoginVerification(sessionId, {
            message: 'Vui lòng kiểm tra email để xác thực đăng nhập',
            email: email
        });

        return {
            message: 'Email xác thực đã được gửi. Vui lòng kiểm tra email và xác nhận đăng nhập.',
            requiresEmailVerification: true
        };
    } catch (error) {
        throw error;
    }
};

// Staff/Admin Login - Step 2: Verify login from email link
exports.verifyStaffAdminLogin = async (loginToken, action) => {
    try {
        const user = await users.findOne({ loginToken });

        if (!user) {
            throw new Error('Token không hợp lệ hoặc đã hết hạn');
        }

        // Check if token is expired
        const currentTime = new Date(new Date().getTime()); // Vietnam time
        const expiryTime = new Date(user.loginTokenExpiry);

        if (currentTime > expiryTime) {
            // Clear expired token
            user.loginToken = undefined;
            user.loginTokenExpiry = undefined;
            user.loginSessionId = undefined;
            await user.save();
            throw new Error('Token đã hết hạn. Vui lòng đăng nhập lại.');
        }

        const sessionId = user.loginSessionId;

        if (action === 'deny') {
            // User denied the login
            user.loginToken = undefined;
            user.loginTokenExpiry = undefined;
            user.loginSessionId = undefined;
            await user.save();

            // Send socket notification - login denied
            const { sendLoginDenied } = require('./socketService');
            sendLoginDenied(sessionId, {
                message: 'Đăng nhập bị từ chối'
            });

            return {
                message: 'Đăng nhập đã bị từ chối',
                denied: true
            };
        }

        // User approved the login
        const token = generateToken(user);

        // Clear login token
        user.loginToken = undefined;
        user.loginTokenExpiry = undefined;
        user.loginSessionId = undefined;
        user.updated_at = new Date();
        await user.save();

        const userResponse = user.toObject();
        delete userResponse.password;

        // Send socket notification - login approved
        const { sendLoginApproved } = require('./socketService');
        sendLoginApproved(sessionId, {
            message: 'Đăng nhập thành công',
            user: userResponse
        });

        return {
            message: 'Xác thực thành công',
            approved: true,
            token,
            user: userResponse
        };
    } catch (error) {
        throw error;
    }
};

/**
 * Verify account invitation token and check if it's valid
 * @param {String} token - Verification token from email
 * @returns {Object} - User info if valid
 */
exports.verifyAccountInvitationToken = async (token) => {
    try {
        if (!token) {
            throw new Error('Token xác thực là bắt buộc');
        }

        // Find user with this token
        const user = await users.findOne({
            loginToken: token,
            loginTokenExpiry: { $gt: new Date() },
            isVerified: false
        });

        if (!user) {
            throw new Error('Token xác thực không hợp lệ hoặc đã hết hạn');
        }

        // Return user info (without sensitive data)
        return {
            email: user.email,
            full_name: user.full_name,
            role: user.role
        };
    } catch (error) {
        throw error;
    }
};

/**
 * Set password for new staff/admin account after email verification
 * @param {String} token - Verification token from email
 * @param {String} password - New password
 * @returns {Object} - Success message and auth token
 */
exports.setPasswordForNewAccount = async (token, password) => {
    try {
        if (!token) {
            throw new Error('Token xác thực là bắt buộc');
        }

        if (!password) {
            throw new Error('Mật khẩu là bắt buộc');
        }

        if (password.length < 6) {
            throw new Error('Mật khẩu phải có ít nhất 6 ký tự');
        }

        // Find user with this token
        const user = await users.findOne({
            loginToken: token,
            loginTokenExpiry: { $gt: new Date() },
            isVerified: false
        });

        if (!user) {
            throw new Error('Token xác thực không hợp lệ hoặc đã hết hạn');
        }

        // Hash password
        const hashedPassword = await hashPassword(password);

        // Update user
        user.password = hashedPassword;
        user.isVerified = true;
        user.loginToken = undefined;
        user.loginTokenExpiry = undefined;
        user.updated_at = new Date();
        await user.save();

        // Generate auth token
        const authToken = generateToken(user);

        // Send welcome email
        await emailService.sendWelcomeEmail(user.email, user.full_name);

        const userResponse = user.toObject();
        delete userResponse.password;
        delete userResponse.otp;
        delete userResponse.otpExpiry;
        delete userResponse.loginToken;
        delete userResponse.loginTokenExpiry;
        delete userResponse.loginSessionId;

        return {
            message: 'Kích hoạt tài khoản thành công',
            token: authToken,
            user: userResponse
        };
    } catch (error) {
        throw error;
    }
};

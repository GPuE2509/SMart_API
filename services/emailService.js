const nodemailer = require('nodemailer');

// Create email transporter
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT),
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS.replace(/\s/g, '') // Remove all whitespaces from app password
    },
    tls: {
        rejectUnauthorized: false
    }
});

// Send OTP email
exports.sendOTPEmail = async (email, otp, fullName) => {
    try {
        const mailOptions = {
            from: `"SMart System" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Xác thực đăng ký tài khoản - SMart',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                    <div style="background-color: #4CAF50; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="color: white; margin: 0;">SMart</h1>
                    </div>
                    <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        <h2 style="color: #333; margin-top: 0;">Xin chào ${fullName}!</h2>
                        <p style="color: #666; font-size: 16px; line-height: 1.5;">
                            Cảm ơn bạn đã đăng ký tài khoản tại <strong>SMart</strong>. 
                            Để hoàn tất quá trình đăng ký, vui lòng sử dụng mã OTP dưới đây:
                        </p>
                        <div style="background-color: #f0f0f0; padding: 20px; text-align: center; border-radius: 5px; margin: 25px 0;">
                            <h1 style="color: #4CAF50; font-size: 36px; margin: 0; letter-spacing: 5px; font-weight: bold;">
                                ${otp}
                            </h1>
                        </div>
                        <p style="color: #666; font-size: 14px; line-height: 1.5;">
                            <strong>Lưu ý:</strong> Mã OTP này có hiệu lực trong vòng <strong>5 phút</strong>. 
                            Vui lòng không chia sẻ mã này với bất kỳ ai.
                        </p>
                        <p style="color: #999; font-size: 13px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                            Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.
                        </p>
                    </div>
                    <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
                        <p>© 2026 SMart. All rights reserved.</p>
                    </div>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('OTP email sent successfully:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending OTP email:', error);
        throw new Error('Không thể gửi email xác thực. Vui lòng thử lại sau.');
    }
};

// Send welcome email after successful verification
exports.sendWelcomeEmail = async (email, fullName) => {
    try {
        const mailOptions = {
            from: `"SMart System" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Chào mừng đến với SMart!',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                    <div style="background-color: #4CAF50; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="color: white; margin: 0;">SMart</h1>
                    </div>
                    <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        <h2 style="color: #333; margin-top: 0;">Chào mừng ${fullName}!</h2>
                        <p style="color: #666; font-size: 16px; line-height: 1.5;">
                            Tài khoản của bạn đã được xác thực thành công! 🎉
                        </p>
                        <p style="color: #666; font-size: 16px; line-height: 1.5;">
                            Bạn đã có thể bắt đầu khám phá và trải nghiệm các dịch vụ tuyệt vời tại SMart.
                        </p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="#" style="background-color: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                                Bắt đầu mua sắm
                            </a>
                        </div>
                        <p style="color: #999; font-size: 13px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                            Nếu bạn cần hỗ trợ, vui lòng liên hệ với chúng tôi.
                        </p>
                    </div>
                    <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
                        <p>© 2026 SMart. All rights reserved.</p>
                    </div>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Welcome email sent successfully:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending welcome email:', error);
        // Don't throw error here, welcome email is not critical
        return { success: false };
    }
};

// Send Password Reset OTP email
exports.sendPasswordResetOTP = async (email, otp, fullName) => {
    try {
        const mailOptions = {
            from: `"SMart System" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Đặt lại mật khẩu - SMart',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                    <div style="background-color: #FF5722; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="color: white; margin: 0;">SMart</h1>
                    </div>
                    <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        <h2 style="color: #333; margin-top: 0;">Xin chào ${fullName}!</h2>
                        <p style="color: #666; font-size: 16px; line-height: 1.5;">
                            Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn tại <strong>SMart</strong>. 
                            Để tiếp tục, vui lòng sử dụng mã OTP dưới đây:
                        </p>
                        <div style="background-color: #fff3e0; padding: 20px; text-align: center; border-radius: 5px; margin: 25px 0; border: 2px solid #FF5722;">
                            <h1 style="color: #FF5722; font-size: 36px; margin: 0; letter-spacing: 5px; font-weight: bold;">
                                ${otp}
                            </h1>
                        </div>
                        <p style="color: #666; font-size: 14px; line-height: 1.5;">
                            <strong>Lưu ý:</strong> Mã OTP này có hiệu lực trong vòng <strong>5 phút</strong>. 
                            Vui lòng không chia sẻ mã này với bất kỳ ai.
                        </p>
                        <div style="background-color: #ffebee; padding: 15px; border-left: 4px solid #f44336; margin: 20px 0;">
                            <p style="color: #c62828; font-size: 14px; margin: 0;">
                                ⚠️ <strong>Cảnh báo bảo mật:</strong> Nếu bạn không yêu cầu đặt lại mật khẩu, 
                                vui lòng bỏ qua email này và đảm bảo tài khoản của bạn an toàn.
                            </p>
                        </div>
                        <p style="color: #999; font-size: 13px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                            Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.
                        </p>
                    </div>
                    <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
                        <p>© 2026 SMart. All rights reserved.</p>
                    </div>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Password reset OTP sent successfully:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending password reset OTP:', error);
        throw new Error('Không thể gửi email đặt lại mật khẩu. Vui lòng thử lại sau.');
    }
};

// Send Password Reset Success email
exports.sendPasswordResetSuccess = async (email, fullName) => {
    try {
        const mailOptions = {
            from: `"SMart System" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Mật khẩu đã được đặt lại thành công - SMart',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                    <div style="background-color: #4CAF50; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="color: white; margin: 0;">SMart</h1>
                    </div>
                    <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        <h2 style="color: #333; margin-top: 0;">Xin chào ${fullName}!</h2>
                        <div style="text-align: center; margin: 20px 0;">
                            <div style="background-color: #4CAF50; color: white; width: 60px; height: 60px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 30px;">
                                ✓
                            </div>
                        </div>
                        <p style="color: #666; font-size: 16px; line-height: 1.5; text-align: center;">
                            Mật khẩu của bạn đã được đặt lại thành công!
                        </p>
                        <p style="color: #666; font-size: 14px; line-height: 1.5;">
                            Bạn có thể đăng nhập ngay bây giờ với mật khẩu mới của mình.
                        </p>
                        <div style="background-color: #fff3e0; padding: 15px; border-left: 4px solid #FF9800; margin: 20px 0;">
                            <p style="color: #E65100; font-size: 14px; margin: 0;">
                                🔐 <strong>Bảo mật tài khoản:</strong> Nếu bạn không thực hiện thay đổi này, 
                                vui lòng liên hệ với chúng tôi ngay lập tức.
                            </p>
                        </div>
                    </div>
                    <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
                        <p>© 2026 SMart. All rights reserved.</p>
                    </div>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Password reset success email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending password reset success email:', error);
        return { success: false };
    }
};

// Send Login Verification Email for Admin/Staff
exports.sendLoginVerification = async (email, fullName, role, loginToken) => {
    try {
        const approveUrl = `${process.env.API_URL || 'http://localhost:3000'}/api/v1/auth/verify-login?token=${loginToken}&action=approve`;
        const denyUrl = `${process.env.API_URL || 'http://localhost:3000'}/api/v1/auth/verify-login?token=${loginToken}&action=deny`;

        const roleText = role === 'admin' ? 'Quản trị viên' : 
                        role === 'seller_staff' ? 'Nhân viên bán hàng' : 
                        'Nhân viên kho';

        const mailOptions = {
            from: `"SMart System" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `Xác thực đăng nhập ${roleText} - SMart`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                    <div style="background-color: #2196F3; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="color: white; margin: 0;">🔐 SMart</h1>
                    </div>
                    <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        <h2 style="color: #333; margin-top: 0;">Xin chào ${fullName}!</h2>
                        
                        <div style="background-color: #E3F2FD; padding: 20px; border-left: 4px solid #2196F3; margin: 20px 0;">
                            <p style="color: #1565C0; font-size: 16px; margin: 0; font-weight: bold;">
                                🔔 Phát hiện yêu cầu đăng nhập mới
                            </p>
                        </div>

                        <p style="color: #666; font-size: 16px; line-height: 1.5;">
                            Chúng tôi phát hiện một yêu cầu đăng nhập vào tài khoản <strong>${roleText}</strong> của bạn.
                        </p>

                        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <p style="margin: 5px 0; color: #666;"><strong>Thời gian:</strong> ${new Date().toLocaleString('vi-VN')}</p>
                            <p style="margin: 5px 0; color: #666;"><strong>Vai trò:</strong> ${roleText}</p>
                        </div>

                        <p style="color: #666; font-size: 16px; line-height: 1.5; margin-top: 25px;">
                            <strong>Đây có phải là bạn không?</strong>
                        </p>

                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${approveUrl}" style="background-color: #4CAF50; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; margin: 10px;">
                                ✓ Đúng là tôi
                            </a>
                            <a href="${denyUrl}" style="background-color: #f44336; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; margin: 10px;">
                                ✗ Không phải tôi
                            </a>
                        </div>

                        <div style="background-color: #fff3e0; padding: 15px; border-left: 4px solid #FF9800; margin: 20px 0;">
                            <p style="color: #E65100; font-size: 14px; margin: 0;">
                                ⚠️ <strong>Lưu ý:</strong> Link xác thực có hiệu lực trong <strong>5 phút</strong>. 
                                Nếu không phải bạn đăng nhập, hãy nhấn "Không phải tôi" ngay lập tức để bảo vệ tài khoản.
                            </p>
                        </div>

                        <p style="color: #999; font-size: 13px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                            Nếu bạn không yêu cầu đăng nhập, vui lòng bỏ qua email này hoặc liên hệ với quản trị viên.
                        </p>
                    </div>
                    <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
                        <p>© 2026 SMart. All rights reserved.</p>
                    </div>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Login verification email sent successfully:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending login verification email:', error);
        throw new Error('Không thể gửi email xác thực đăng nhập. Vui lòng thử lại sau.');
    }
};

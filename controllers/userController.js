const userService = require('../services/userService');
const multer = require('multer');
const path = require('path');

// Configure multer for memory storage (store as base64)
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Chỉ chấp nhận file ảnh (jpeg, jpg, png, gif)'));
        }
    }
}).single('avatar');

// Get current user profile
exports.getMyProfile = async (req, res) => {
    try {
        // req.user is set by authMiddleware
        const userId = req.user._id;
        const user = await userService.getUserProfile(userId);

        res.status(200).json({
            message: 'Lấy thông tin profile thành công',
            data: user
        });
    } catch (error) {
        if (error.message === 'Không tìm thấy người dùng') {
            return res.status(404).json({
                error: error.message
            });
        }
        res.status(500).json({
            message: 'Lỗi khi lấy thông tin profile',
            error: error.message
        });
    }
};

// Update current user profile
exports.updateMyProfile = async (req, res) => {
    try {
        // req.user is set by authMiddleware
        const userId = req.user._id;
        const updateData = req.body;

        console.log('=== UPDATE PROFILE REQUEST ===');
        console.log('User ID:', userId);
        console.log('Update Data:', JSON.stringify(updateData, null, 2));

        // Prevent users from updating sensitive fields
        delete updateData.email;
        delete updateData.password;
        delete updateData.role;
        delete updateData.status;
        delete updateData.loyalty_points;
        delete updateData.isVerified;

        const updatedUser = await userService.updateUserProfile(userId, updateData);

        res.status(200).json({
            message: 'Cập nhật profile thành công',
            data: updatedUser
        });
    } catch (error) {
        console.error('=== UPDATE PROFILE ERROR ===');
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        if (error.message === 'Không tìm thấy người dùng') {
            return res.status(404).json({
                error: error.message
            });
        }
        if (error.message === 'Số điện thoại không hợp lệ' || 
            error.message === 'Số điện thoại đã được sử dụng') {
            return res.status(400).json({
                error: error.message
            });
        }
        res.status(500).json({
            message: 'Lỗi khi cập nhật profile',
            error: error.message
        });
    }
};

// Get user profile by ID (Admin only)
exports.getUserProfile = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await userService.getUserProfile(userId);

        res.status(200).json({
            message: 'Lấy thông tin người dùng thành công',
            data: user
        });
    } catch (error) {
        if (error.message === 'Không tìm thấy người dùng') {
            return res.status(404).json({
                error: error.message
            });
        }
        res.status(500).json({
            message: 'Lỗi khi lấy thông tin người dùng',
            error: error.message
        });
    }
};

// Get all users (Admin only)
exports.getAllUsers = async (req, res) => {
    try {
        const queryParams = {
            page: req.query.page,
            limit: req.query.limit,
            search: req.query.search,
            role: req.query.role,
            status: req.query.status
        };

        const result = await userService.getAllUsers(queryParams);

        res.status(200).json({
            message: 'Lấy danh sách người dùng thành công',
            data: result.data,
            pagination: result.pagination
        });
    } catch (error) {
        res.status(500).json({
            message: 'Lỗi khi lấy danh sách người dùng',
            error: error.message
        });
    }
};

// Update user status (Admin only)
exports.updateUserStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        const { status } = req.body;

        if (!status || !['active', 'blocked'].includes(status)) {
            return res.status(400).json({
                message: 'Trạng thái không hợp lệ. Phải là "active" hoặc "blocked"'
            });
        }

        const updatedUser = await userService.updateUserStatus(userId, status);

        res.status(200).json({
            message: 'Cập nhật trạng thái người dùng thành công',
            data: updatedUser
        });
    } catch (error) {
        if (error.message === 'Không tìm thấy người dùng') {
            return res.status(404).json({
                error: error.message
            });
        }
        if (error.message === 'Không thể thay đổi trạng thái của tài khoản admin') {
            return res.status(403).json({
                error: error.message
            });
        }
        res.status(500).json({
            message: 'Lỗi khi cập nhật trạng thái người dùng',
            error: error.message
        });
    }
};

// Update user role (Admin only)
exports.updateUserRole = async (req, res) => {
    try {
        const { userId } = req.params;
        const { role } = req.body;

        if (!role) {
            return res.status(400).json({
                message: 'Vai trò là bắt buộc'
            });
        }

        const updatedUser = await userService.updateUserRole(userId, role);

        res.status(200).json({
            message: 'Cập nhật vai trò người dùng thành công',
            data: updatedUser
        });
    } catch (error) {
        if (error.message === 'Không tìm thấy người dùng') {
            return res.status(404).json({
                error: error.message
            });
        }
        if (error.message === 'Vai trò không hợp lệ') {
            return res.status(400).json({
                error: error.message
            });
        }
        res.status(500).json({
            message: 'Lỗi khi cập nhật vai trò người dùng',
            error: error.message
        });
    }
};

// Delete user (Admin only)
exports.deleteUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const result = await userService.deleteUser(userId);

        res.status(200).json(result);
    } catch (error) {
        if (error.message === 'Không tìm thấy người dùng') {
            return res.status(404).json({
                error: error.message
            });
        }
        if (error.message === 'Không thể xóa tài khoản admin') {
            return res.status(403).json({
                error: error.message
            });
        }
        res.status(500).json({
            message: 'Lỗi khi xóa người dùng',
            error: error.message
        });
    }
};

// Update user profile by Admin
exports.updateUserProfile = async (req, res) => {
    try {
        const { userId } = req.params;
        const updateData = req.body;

        // Admin can't update email, password, or isVerified through this endpoint
        delete updateData.email;
        delete updateData.password;
        delete updateData.isVerified;

        const updatedUser = await userService.updateUserProfile(userId, updateData);

        res.status(200).json({
            message: 'Cập nhật thông tin người dùng thành công',
            data: updatedUser
        });
    } catch (error) {
        if (error.message === 'Không tìm thấy người dùng') {
            return res.status(404).json({
                error: error.message
            });
        }
        if (error.message === 'Số điện thoại không hợp lệ' || 
            error.message === 'Số điện thoại đã được sử dụng') {
            return res.status(400).json({
                error: error.message
            });
        }
        res.status(500).json({
            message: 'Lỗi khi cập nhật thông tin người dùng',
            error: error.message
        });
    }
};

// Upload avatar
exports.uploadAvatar = async (req, res) => {
    upload(req, res, async (err) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({
                    error: 'File quá lớn. Kích thước tối đa là 5MB'
                });
            }
            return res.status(400).json({
                error: 'Lỗi khi upload file: ' + err.message
            });
        } else if (err) {
            return res.status(400).json({
                error: err.message
            });
        }

        if (!req.file) {
            return res.status(400).json({
                error: 'Vui lòng chọn file ảnh'
            });
        }

        try {
            const userId = req.user._id;

            // Convert to base64
            const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

            // Update user avatar
            const updatedUser = await userService.updateUserProfile(userId, {
                avatar_url: base64Image
            });

            res.status(200).json({
                message: 'Upload ảnh đại diện thành công',
                data: updatedUser
            });
        } catch (error) {
            console.error('=== UPLOAD AVATAR ERROR ===');
            console.error('Error message:', error.message);
            
            res.status(500).json({
                message: 'Lỗi khi upload ảnh đại diện',
                error: error.message
            });
        }
    });
};

// Export upload middleware
exports.uploadMiddleware = upload;

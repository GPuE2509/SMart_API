const User = require('../models/User');
const bcrypt = require('bcrypt');

// Get user profile by ID
exports.getUserProfile = async (userId) => {
    try {
        const user = await User.findById(userId).select('-password -otp -otpExpiry -loginToken -loginTokenExpiry -loginSessionId');
        
        if (!user) {
            throw new Error('Không tìm thấy người dùng');
        }

        return user;
    } catch (error) {
        throw error;
    }
};

// Update user profile
exports.updateUserProfile = async (userId, updateData) => {
    try {
        console.log('Service: Finding user by ID:', userId);
        const user = await User.findById(userId);
        
        if (!user) {
            throw new Error('Không tìm thấy người dùng');
        }

        console.log('Service: Found user:', user.email);
        console.log('Service: Current phone:', user.phone);
        console.log('Service: Update data:', updateData);

        // Fields allowed to be updated
        const allowedFields = ['full_name', 'phone', 'avatar_url', 'address'];
        
        // Update only allowed fields
        allowedFields.forEach(field => {
            if (updateData[field] !== undefined) {
                if (field === 'address') {
                    console.log('Service: Updating address:', updateData.address);
                    // Handle address object
                    user.address = {
                        street: updateData.address.street || user.address?.street || '',
                        ward: updateData.address.ward || user.address?.ward || '',
                        district: updateData.address.district || user.address?.district || '',
                        city: updateData.address.city || user.address?.city || ''
                    };
                } else {
                    console.log(`Service: Updating ${field}:`, updateData[field]);
                    user[field] = updateData[field];
                }
            }
        });

        // Validate phone number if updated
        if (updateData.phone) {
            console.log('Service: Validating phone number');
            const phoneRegex = /^(0[3|5|7|8|9])+([0-9]{8})$/;
            if (!phoneRegex.test(updateData.phone)) {
                throw new Error('Số điện thoại không hợp lệ');
            }

            // Check if phone already exists (only if it's different from current phone)
            const currentPhone = await User.findById(userId).select('phone');
            if (updateData.phone !== currentPhone.phone) {
                console.log('Service: Checking if phone exists');
                const existingPhone = await User.findOne({ 
                    phone: updateData.phone,
                    _id: { $ne: userId }
                });
                if (existingPhone) {
                    throw new Error('Số điện thoại đã được sử dụng');
                }
            }
        }

        console.log('Service: Saving user...');
        user.updated_at = new Date();
        await user.save();
        console.log('Service: User saved successfully');

        // Return user without sensitive data
        const userResponse = user.toObject();
        delete userResponse.password;
        delete userResponse.otp;
        delete userResponse.otpExpiry;
        delete userResponse.loginToken;
        delete userResponse.loginTokenExpiry;
        delete userResponse.loginSessionId;

        return userResponse;
    } catch (error) {
        console.error('Service: Error in updateUserProfile:', error.message);
        throw error;
    }
};

// Get all users (Admin only)
exports.getAllUsers = async (queryParams) => {
    try {
        const { page = 1, limit = 10, search, role, status } = queryParams;
        
        const query = {};

        // Search by full_name, email, or phone
        if (search) {
            query.$or = [
                { full_name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } }
            ];
        }

        // Filter by role
        if (role) {
            query.role = role;
        }

        // Filter by status
        if (status) {
            query.status = status;
        }

        const skip = (page - 1) * limit;

        const users = await User.find(query)
            .select('-password -otp -otpExpiry -loginToken -loginTokenExpiry -loginSessionId')
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await User.countDocuments(query);

        return {
            data: users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    } catch (error) {
        throw error;
    }
};

// Update user status (Admin only)
exports.updateUserStatus = async (userId, status) => {
    try {
        const user = await User.findById(userId);
        
        if (!user) {
            throw new Error('Không tìm thấy người dùng');
        }

        if (user.role === 'admin') {
            throw new Error('Không thể thay đổi trạng thái của tài khoản admin');
        }

        user.status = status;
        user.updated_at = new Date();
        await user.save();

        const userResponse = user.toObject();
        delete userResponse.password;
        delete userResponse.otp;
        delete userResponse.otpExpiry;
        delete userResponse.loginToken;
        delete userResponse.loginTokenExpiry;
        delete userResponse.loginSessionId;

        return userResponse;
    } catch (error) {
        throw error;
    }
};

// Update user role (Admin only)
exports.updateUserRole = async (userId, role) => {
    try {
        const user = await User.findById(userId);
        
        if (!user) {
            throw new Error('Không tìm thấy người dùng');
        }

        const validRoles = ['admin', 'seller_staff', 'repository_staff', 'customer'];
        if (!validRoles.includes(role)) {
            throw new Error('Vai trò không hợp lệ');
        }

        user.role = role;
        user.updated_at = new Date();
        await user.save();

        const userResponse = user.toObject();
        delete userResponse.password;
        delete userResponse.otp;
        delete userResponse.otpExpiry;
        delete userResponse.loginToken;
        delete userResponse.loginTokenExpiry;
        delete userResponse.loginSessionId;

        return userResponse;
    } catch (error) {
        throw error;
    }
};

// Delete user (Admin only - soft delete by setting status to blocked)
exports.deleteUser = async (userId) => {
    try {
        const user = await User.findById(userId);
        
        if (!user) {
            throw new Error('Không tìm thấy người dùng');
        }

        if (user.role === 'admin') {
            throw new Error('Không thể xóa tài khoản admin');
        }

        // Soft delete - set status to blocked
        user.status = 'blocked';
        user.updated_at = new Date();
        await user.save();

        return { message: 'Đã xóa người dùng thành công' };
    } catch (error) {
        throw error;
    }
};

const User = require('../../models/User');
const StaffAttendance = require('../../models/StaffAttendance');
const mongoose = require('mongoose');
const { uploadImage } = require('../../utils/uploadImage');

class AttendanceService {
  // Register face descriptor for staff
  async registerStaffFace(userId, faceDescriptor, faceImage) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      if (!['seller_staff', 'repository_staff', 'admin'].includes(user.role)) {
        throw new Error('Only staff members can register face for attendance');
      }

      // Upload face image to Cloudinary
      const face_image_url = await uploadImage(faceImage, 'smart/faces');

      user.face_descriptor = faceDescriptor;
      user.face_image_url = face_image_url;
      await user.save();

      return {
        success: true,
        message: 'Face registered successfully',
        user: {
          _id: user._id,
          full_name: user.full_name,
          email: user.email,
          role: user.role
        }
      };
    } catch (error) {
      throw error;
    }
  }

  // Check-in with face recognition
  async checkIn(userId, faceDescriptor, matchConfidence) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      if (!['seller_staff', 'repository_staff'].includes(user.role)) {
        throw new Error('Only staff members can check-in');
      }

      if (!user.face_descriptor || user.face_descriptor.length === 0) {
        throw new Error('Face not registered. Please contact admin to register your face.');
      }

      // Check if already checked in today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const existingAttendance = await StaffAttendance.findOne({
        user_id: userId,
        check_in_time: { $gte: today, $lt: tomorrow }
      });

      if (existingAttendance && existingAttendance.status !== 'checked_out') {
        throw new Error('Already checked in today');
      }

      // Create new attendance record
      const attendance = new StaffAttendance({
        user_id: userId,
        check_in_time: new Date(),
        check_in_face_match: matchConfidence,
        status: 'checked_in'
      });

      await attendance.save();

      return {
        success: true,
        message: 'Check-in successful',
        attendance: {
          _id: attendance._id,
          check_in_time: attendance.check_in_time,
          match_confidence: matchConfidence
        }
      };
    } catch (error) {
      throw error;
    }
  }

  // Check-out with face recognition
  async checkOut(userId, faceDescriptor, matchConfidence) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      if (!['seller_staff', 'repository_staff'].includes(user.role)) {
        throw new Error('Only staff members can check-out');
      }

      // Find today's attendance record
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const attendance = await StaffAttendance.findOne({
        user_id: userId,
        check_in_time: { $gte: today, $lt: tomorrow },
        status: 'checked_in'
      });

      if (!attendance) {
        throw new Error('No check-in record found for today. Please check-in first.');
      }

      attendance.check_out_time = new Date();
      attendance.check_out_face_match = matchConfidence;
      attendance.status = 'checked_out';
      await attendance.save();

      return {
        success: true,
        message: 'Check-out successful',
        attendance: {
          _id: attendance._id,
          check_in_time: attendance.check_in_time,
          check_out_time: attendance.check_out_time,
          match_confidence: matchConfidence
        }
      };
    } catch (error) {
      throw error;
    }
  }

  // Get staff attendance history
  async getAttendanceHistory(userId, startDate, endDate) {
    try {
      const query = { user_id: userId };
      
      if (startDate || endDate) {
        query.check_in_time = {};
        if (startDate) query.check_in_time.$gte = new Date(startDate);
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          query.check_in_time.$lte = end;
        }
      }

      const attendance = await StaffAttendance.find(query)
        .populate('user_id', 'full_name email role')
        .sort({ check_in_time: -1 });

      return {
        success: true,
        attendance
      };
    } catch (error) {
      throw error;
    }
  }

  // Get all staff attendance (for admin)
  async getAllStaffAttendance(startDate, endDate, role, search, page = 1, limit = 10) {
    try {
      // Build aggregation pipeline
      const pipeline = [];

      // Match by date range
      const matchStage = {};
      if (startDate || endDate) {
        matchStage.check_in_time = {};
        if (startDate) matchStage.check_in_time.$gte = new Date(startDate);
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          matchStage.check_in_time.$lte = end;
        }
      }
      if (Object.keys(matchStage).length > 0) {
        pipeline.push({ $match: matchStage });
      }

      // Lookup user
      pipeline.push({
        $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: '_id',
          as: 'user_id'
        }
      });

      // Unwind user (convert array to object)
      pipeline.push({ $unwind: { path: '$user_id', preserveNullAndEmptyArrays: false } });

      // Match by role and search
      const userMatchStage = {};
      if (role && ['seller_staff', 'repository_staff'].includes(role)) {
        userMatchStage['user_id.role'] = role;
      }
      if (search && search.trim()) {
        const searchRegex = new RegExp(search.trim(), 'i');
        userMatchStage.$or = [
          { 'user_id.full_name': searchRegex },
          { 'user_id.email': searchRegex }
        ];
      }
      if (Object.keys(userMatchStage).length > 0) {
        pipeline.push({ $match: userMatchStage });
      }

      // Add facet for count and data
      pipeline.push({
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [
            { $sort: { check_in_time: -1 } },
            { $skip: (page - 1) * limit },
            { $limit: limit },
            {
              $project: {
                check_in_time: 1,
                check_out_time: 1,
                check_in_face_match: 1,
                check_out_face_match: 1,
                status: 1,
                user_id: {
                  _id: 1,
                  full_name: 1,
                  email: 1,
                  role: 1,
                  avatar_url: 1
                }
              }
            }
          ]
        }
      });

      const result = await StaffAttendance.aggregate(pipeline);
      
      const total = result[0]?.metadata[0]?.total || 0;
      const attendance = result[0]?.data || [];

      return {
        success: true,
        attendance: attendance,
        pagination: {
          total: total,
          page: page,
          limit: limit,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw error;
    }
  }

  // Get staff member's face data (for verification)
  async getStaffFaceData(userId) {
    try {
      const user = await User.findById(userId).select('face_descriptor full_name email role');
      
      if (!user) {
        throw new Error('User not found');
      }

      if (!user.face_descriptor || user.face_descriptor.length === 0) {
        throw new Error('Face not registered');
      }

      return {
        success: true,
        faceDescriptor: user.face_descriptor,
        userInfo: {
          _id: user._id,
          full_name: user.full_name,
          email: user.email,
          role: user.role
        }
      };
    } catch (error) {
      throw error;
    }
  }

  // Get all staff with face registered
  async getAllStaffWithFace() {
    try {
      const staff = await User.find({
        role: { $in: ['seller_staff', 'repository_staff'] },
        face_descriptor: { $exists: true, $ne: [] }
      }).select('_id full_name email role face_image_url');

      return {
        success: true,
        staff
      };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new AttendanceService();

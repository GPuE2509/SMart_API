const User = require('../../models/User');
const StaffAttendance = require('../../models/StaffAttendance');
const mongoose = require('mongoose');

class AttendanceService {
  // Register face descriptor for staff
  async registerStaffFace(userId, faceDescriptor, faceImageUrl) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      if (!['seller_staff', 'repository_staff', 'admin'].includes(user.role)) {
        throw new Error('Only staff members can register face for attendance');
      }

      user.face_descriptor = faceDescriptor;
      user.face_image_url = faceImageUrl;
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
  async getAllStaffAttendance(startDate, endDate, role) {
    try {
      const query = {};
      
      if (startDate || endDate) {
        query.check_in_time = {};
        if (startDate) query.check_in_time.$gte = new Date(startDate);
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          query.check_in_time.$lte = end;
        }
      }

      const populateQuery = {
        path: 'user_id',
        select: 'full_name email role avatar_url'
      };

      if (role && ['seller_staff', 'repository_staff'].includes(role)) {
        populateQuery.match = { role };
      }

      const attendance = await StaffAttendance.find(query)
        .populate(populateQuery)
        .sort({ check_in_time: -1 });

      // Filter out null user_id (in case user was deleted)
      const filteredAttendance = attendance.filter(att => att.user_id);

      return {
        success: true,
        attendance: filteredAttendance
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

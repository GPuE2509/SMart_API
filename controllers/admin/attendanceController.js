const attendanceService = require('../../services/admin/attendanceService');

class AttendanceController {
  // Register face for staff (Admin only)
  async registerStaffFace(req, res) {
    try {
      const { userId, faceDescriptor, faceImage } = req.body;

      if (!userId || !faceDescriptor || !faceImage) {
        return res.status(400).json({
          success: false,
          message: 'User ID, face descriptor, and face image are required'
        });
      }

      const result = await attendanceService.registerStaffFace(userId, faceDescriptor, faceImage);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Staff check-in
  async checkIn(req, res) {
    try {
      const { userId, faceDescriptor, matchConfidence } = req.body;

      if (!userId || !faceDescriptor || matchConfidence === undefined) {
        return res.status(400).json({
          success: false,
          message: 'User ID, face descriptor, and match confidence are required'
        });
      }

      // Verify match confidence is acceptable (e.g., > 0.6)
      if (matchConfidence < 0.6) {
        return res.status(400).json({
          success: false,
          message: 'Face match confidence too low. Please try again.'
        });
      }

      const result = await attendanceService.checkIn(userId, faceDescriptor, matchConfidence);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Staff check-out
  async checkOut(req, res) {
    try {
      const { userId, faceDescriptor, matchConfidence } = req.body;

      if (!userId || !faceDescriptor || matchConfidence === undefined) {
        return res.status(400).json({
          success: false,
          message: 'User ID, face descriptor, and match confidence are required'
        });
      }

      // Verify match confidence is acceptable
      if (matchConfidence < 0.6) {
        return res.status(400).json({
          success: false,
          message: 'Face match confidence too low. Please try again.'
        });
      }

      const result = await attendanceService.checkOut(userId, faceDescriptor, matchConfidence);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get attendance history for a staff member
  async getAttendanceHistory(req, res) {
    try {
      const { userId } = req.params;
      const { startDate, endDate } = req.query;

      const result = await attendanceService.getAttendanceHistory(userId, startDate, endDate);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get all staff attendance (Admin only)
  async getAllStaffAttendance(req, res) {
    try {
      const { startDate, endDate, role, search, page, limit } = req.query;

      const result = await attendanceService.getAllStaffAttendance(
        startDate, 
        endDate, 
        role, 
        search,
        parseInt(page) || 1,
        parseInt(limit) || 10
      );
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get staff face data
  async getStaffFaceData(req, res) {
    try {
      const { userId } = req.params;

      const result = await attendanceService.getStaffFaceData(userId);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get all staff with face registered
  async getAllStaffWithFace(req, res) {
    try {
      const result = await attendanceService.getAllStaffWithFace();
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new AttendanceController();

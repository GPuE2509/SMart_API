const payrollService = require("../../services/staff/payrollService");

class StaffPayrollController {
  /**
   * GET /api/v1/staff/payroll
   * Get own payroll list
   */
  async getMyPayrollList(req, res) {
    try {
      const userId = req.user._id;
      const { year, page, limit } = req.query;

      const result = await payrollService.getMyPayrollList(userId, {
        year,
        page,
        limit,
      });

      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * GET /api/v1/staff/payroll/summary
   * Get yearly payroll summary
   */
  async getMyPayrollSummary(req, res) {
    try {
      const userId = req.user._id;
      const { year } = req.query;

      const result = await payrollService.getMyPayrollSummary(userId, year);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * GET /api/v1/staff/payroll/attendance
   * Get current month attendance
   */
  async getMyCurrentMonthAttendance(req, res) {
    try {
      const userId = req.user._id;

      const result = await payrollService.getMyCurrentMonthAttendance(userId);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * GET /api/v1/staff/payroll/sales
   * Get current month sales (for seller_staff)
   */
  async getMyCurrentMonthSales(req, res) {
    try {
      const userId = req.user._id;

      // Check if user is seller_staff
      if (req.user.role !== "seller_staff") {
        return res.status(403).json({
          success: false,
          message: "Sales data is only available for seller staff",
        });
      }

      const result = await payrollService.getMyCurrentMonthSales(userId);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * GET /api/v1/staff/payroll/:payslipId
   * Get payslip detail
   */
  async getMyPayslipDetail(req, res) {
    try {
      const userId = req.user._id;
      const { payslipId } = req.params;

      const result = await payrollService.getMyPayslipDetail(userId, payslipId);
      return res.status(200).json(result);
    } catch (error) {
      if (error.message === "Payslip not found or unauthorized") {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
}

module.exports = new StaffPayrollController();

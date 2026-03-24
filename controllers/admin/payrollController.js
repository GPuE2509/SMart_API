const payrollService = require("../../services/admin/payrollService");

class PayrollAdminController {
  /**
   * POST /api/v1/admin/payroll/calculate
   * Calculate payroll for a single staff member
   */
  async calculatePayroll(req, res) {
    try {
      const {
        user_id,
        month,
        year,
        hourly_rate,
        base_salary,
        sales_commission_rate,
      } = req.body;
      const adminId = req.user._id;

      if (!user_id || !month || !year) {
        return res.status(400).json({
          success: false,
          message: "User ID, month, and year are required",
        });
      }

      const result = await payrollService.calculateStaffPayroll(
        user_id,
        parseInt(month),
        parseInt(year),
        adminId,
        { hourly_rate, base_salary, sales_commission_rate },
      );

      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * POST /api/v1/admin/payroll/calculate-all
   * Calculate payroll for all active staff members
   */
  async bulkCalculatePayroll(req, res) {
    try {
      const { month, year, hourly_rate, base_salary, sales_commission_rate } =
        req.body;
      const adminId = req.user._id;

      if (!month || !year) {
        return res.status(400).json({
          success: false,
          message: "Month and year are required",
        });
      }

      const result = await payrollService.bulkCalculatePayroll(
        parseInt(month),
        parseInt(year),
        adminId,
        { hourly_rate, base_salary, sales_commission_rate },
      );

      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * GET /api/v1/admin/payroll/report
   * Get payroll report for a specific month/year
   */
  async getPayrollReport(req, res) {
    try {
      const { month, year, role, search, page, limit } = req.query;

      if (!month || !year) {
        return res.status(400).json({
          success: false,
          message: "Month and year are required",
        });
      }

      const result = await payrollService.getPayrollReport(month, year, {
        role,
        search,
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
   * GET /api/v1/admin/payroll/:payslipId
   * Get payslip detail
   */
  async getPayslipDetail(req, res) {
    try {
      const { payslipId } = req.params;

      const result = await payrollService.getPayslipDetail(payslipId);
      return res.status(200).json(result);
    } catch (error) {
      if (error.message === "Payslip not found") {
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

  /**
   * POST /api/v1/admin/payroll/:payslipId/adjustment
   * Add bonus or deduction to payslip
   */
  async addAdjustment(req, res) {
    try {
      const { payslipId } = req.params;
      const { type, amount, reason } = req.body;
      const adminId = req.user._id;

      if (!type || !amount) {
        return res.status(400).json({
          success: false,
          message: "Type and amount are required",
        });
      }

      if (!["bonus", "deduction"].includes(type)) {
        return res.status(400).json({
          success: false,
          message: 'Type must be "bonus" or "deduction"',
        });
      }

      if (amount <= 0) {
        return res.status(400).json({
          success: false,
          message: "Amount must be greater than 0",
        });
      }

      const result = await payrollService.addAdjustment(
        payslipId,
        { type, amount, reason },
        adminId,
      );

      return res.status(200).json(result);
    } catch (error) {
      if (error.message === "Payslip not found") {
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

  /**
   * DELETE /api/v1/admin/payroll/:payslipId/adjustment/:adjustmentId
   * Remove adjustment from payslip
   */
  async removeAdjustment(req, res) {
    try {
      const { payslipId, adjustmentId } = req.params;

      const result = await payrollService.removeAdjustment(
        payslipId,
        adjustmentId,
      );
      return res.status(200).json(result);
    } catch (error) {
      if (error.message === "Payslip not found") {
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

  /**
   * PATCH /api/v1/admin/payroll/:payslipId/status
   * Update payment status
   */
  async updatePaymentStatus(req, res) {
    try {
      const { payslipId } = req.params;
      const { status } = req.body;
      const adminId = req.user._id;

      if (!status || !["pending", "paid"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Valid status (pending or paid) is required",
        });
      }

      const result = await payrollService.updatePaymentStatus(
        payslipId,
        status,
        adminId,
      );
      return res.status(200).json(result);
    } catch (error) {
      if (error.message === "Payslip not found") {
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

  /**
   * GET /api/v1/admin/payroll/export/excel
   * Export payroll report to Excel
   */
  async exportToExcel(req, res) {
    try {
      const { month, year, role } = req.query;

      if (!month || !year) {
        return res.status(400).json({
          success: false,
          message: "Month and year are required",
        });
      }

      const workbook = await payrollService.exportToExcel(month, year, role);

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=payroll_${month}_${year}.xlsx`,
      );

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * GET /api/v1/admin/payroll/export/pdf
   * Export payroll report to PDF
   */
  async exportToPDF(req, res) {
    try {
      const { month, year, role } = req.query;

      if (!month || !year) {
        return res.status(400).json({
          success: false,
          message: "Month and year are required",
        });
      }

      const doc = await payrollService.exportToPDF(month, year, role);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=payroll_${month}_${year}.pdf`,
      );

      doc.pipe(res);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
}

module.exports = new PayrollAdminController();

const Payslip = require("../../models/Payslip");
const User = require("../../models/User");
const StaffAttendance = require("../../models/StaffAttendance");
const Order = require("../../models/Order");
const mongoose = require("mongoose");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");

// Default configuration for salary calculation
const SALARY_CONFIG = {
  DEFAULT_HOURLY_RATE: 30000, // VND per hour
  DEFAULT_BASE_SALARY: 4000000, // VND per month
  SALES_COMMISSION_RATE: 1, // 1% of sales
  STANDARD_WORK_HOURS_PER_DAY: 8,
  STANDARD_WORK_DAYS_PER_MONTH: 26,
};

class PayrollAdminService {
  resolvePayrollDateRange(month, year, customConfig = {}) {
    const monthStartDate = new Date(year, month - 1, 1);
    const monthEndDate = new Date(year, month, 0, 23, 59, 59, 999);

    let startDate = monthStartDate;
    let endDate = monthEndDate;

    if (customConfig.start_date && customConfig.end_date) {
      startDate = new Date(customConfig.start_date);
      endDate = new Date(customConfig.end_date);

      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        throw new Error("Invalid payroll date range");
      }

      if (startDate > endDate) {
        throw new Error("Payroll start date must be before end date");
      }

      if (endDate > monthEndDate) {
        throw new Error("Payroll end date cannot be after selected month/year");
      }

      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    }

    return { startDate, endDate, monthStartDate, monthEndDate };
  }

  /**
   * Calculate staff payroll for a specific month
   */
  async calculateStaffPayroll(userId, month, year, adminId, customConfig = {}) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error("User not found");
      }

      if (!["seller_staff", "repository_staff"].includes(user.role)) {
        throw new Error("Can only calculate payroll for staff members");
      }

      // Get date range for payroll period (full month by default)
      const { startDate, endDate, monthStartDate, monthEndDate } =
        this.resolvePayrollDateRange(month, year, customConfig);

      // Calculate attendance data
      const attendanceData = await this.calculateAttendanceData(
        userId,
        startDate,
        endDate,
      );

      // Calculate sales data (for seller_staff)
      let salesData = {
        total_sales_amount: 0,
        total_orders_processed: 0,
        sales_commission: 0,
      };
      if (user.role === "seller_staff") {
        salesData = await this.calculateSalesData(
          userId,
          startDate,
          endDate,
          customConfig,
        );
      }

      // Calculate salary components
      const hourlyRate =
        customConfig.hourly_rate || SALARY_CONFIG.DEFAULT_HOURLY_RATE;
      const baseSalary =
        customConfig.base_salary || SALARY_CONFIG.DEFAULT_BASE_SALARY;
      const hoursBasedSalary = attendanceData.total_work_hours * hourlyRate;

      // Calculate attendance rate
      const periodDays =
        Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
      const monthDays =
        Math.floor((monthEndDate - monthStartDate) / (1000 * 60 * 60 * 24)) + 1;
      const standardWorkDays = Math.max(
        1,
        Math.round(
          (SALARY_CONFIG.STANDARD_WORK_DAYS_PER_MONTH * periodDays) / monthDays,
        ),
      );
      const attendanceRate = Math.min(
        (attendanceData.total_work_days / standardWorkDays) * 100,
        100,
      );

      // Only update when the exact payroll period already exists.
      // This allows creating multiple payslips in the same month/year.
      let payslip = await Payslip.findOne({
        user_id: userId,
        period_start_date: startDate,
        period_end_date: endDate,
      });

      const payslipData = {
        user_id: userId,
        month,
        year,
        period_start_date: startDate,
        period_end_date: endDate,
        total_work_hours: attendanceData.total_work_hours,
        total_work_days: attendanceData.total_work_days,
        hourly_rate: hourlyRate,
        attendance_rate: Math.round(attendanceRate * 100) / 100,
        total_sales_amount: salesData.total_sales_amount,
        total_orders_processed: salesData.total_orders_processed,
        sales_commission_rate:
          salesData.commission_rate || SALARY_CONFIG.SALES_COMMISSION_RATE,
        sales_commission: salesData.sales_commission,
        base_salary: baseSalary,
        hours_based_salary: hoursBasedSalary,
        created_by: adminId,
      };

      // Calculate totals
      const existingAdjustments = payslip?.adjustments || [];
      const totalBonus = existingAdjustments
        .filter((adj) => adj.type === "bonus")
        .reduce((sum, adj) => sum + adj.amount, 0);
      const totalDeductions = existingAdjustments
        .filter((adj) => adj.type === "deduction")
        .reduce((sum, adj) => sum + adj.amount, 0);

      payslipData.total_bonus = totalBonus;
      payslipData.total_deductions = totalDeductions;
      payslipData.gross =
        baseSalary + hoursBasedSalary + salesData.sales_commission + totalBonus;
      payslipData.net = payslipData.gross - totalDeductions;

      if (payslip) {
        // Update existing payslip
        Object.assign(payslip, payslipData);
        await payslip.save();
      } else {
        // Create new payslip
        payslip = new Payslip(payslipData);
        await payslip.save();
      }

      return {
        success: true,
        message: "Payroll calculated successfully",
        payslip: await Payslip.findById(payslip._id)
          .populate("user_id", "full_name email phone role")
          .populate("created_by", "full_name"),
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Calculate attendance data for a user
   */
  async calculateAttendanceData(userId, startDate, endDate) {
    const attendances = await StaffAttendance.find({
      user_id: userId,
      check_in_time: { $gte: startDate, $lte: endDate },
      status: "checked_out",
    });

    let totalWorkHours = 0;
    let totalWorkDays = attendances.length;

    for (const attendance of attendances) {
      if (attendance.check_in_time && attendance.check_out_time) {
        const hours =
          (attendance.check_out_time - attendance.check_in_time) /
          (1000 * 60 * 60);
        totalWorkHours += Math.min(hours, 12); // Cap at 12 hours per day
      }
    }

    return {
      total_work_hours: Math.round(totalWorkHours * 100) / 100,
      total_work_days: totalWorkDays,
    };
  }

  /**
   * Calculate sales data for seller_staff
   */
  async calculateSalesData(userId, startDate, endDate, customConfig = {}) {
    const commissionRate =
      customConfig.sales_commission_rate || SALARY_CONFIG.SALES_COMMISSION_RATE;

    const orders = await Order.aggregate([
      {
        $match: {
          staff_id: new mongoose.Types.ObjectId(userId),
          created_at: { $gte: startDate, $lte: endDate },
          order_status: "completed",
          payment_status: "paid",
        },
      },
      {
        $group: {
          _id: null,
          total_sales_amount: { $sum: "$final_amount" },
          total_orders_processed: { $sum: 1 },
        },
      },
    ]);

    const result = orders[0] || {
      total_sales_amount: 0,
      total_orders_processed: 0,
    };
    const salesCommission = (result.total_sales_amount * commissionRate) / 100;

    return {
      total_sales_amount: result.total_sales_amount,
      total_orders_processed: result.total_orders_processed,
      commission_rate: commissionRate,
      sales_commission: Math.round(salesCommission),
    };
  }

  /**
   * Get all staff payroll report
   */
  async getPayrollReport(month, year, options = {}) {
    try {
      const { role, search, page = 1, limit = 10 } = options;
      const targetMonth = parseInt(month);
      const targetYear = parseInt(year);
      const monthStart = new Date(targetYear, targetMonth - 1, 1);
      const monthEnd = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

      const pipeline = [
        {
          $match: {
            $or: [
              {
                period_start_date: { $exists: true, $ne: null, $gte: monthStart },
                period_end_date: { $exists: true, $ne: null, $lte: monthEnd },
              },
              {
                $and: [
                  {
                    $or: [
                      { period_start_date: { $exists: false } },
                      { period_start_date: null },
                    ],
                  },
                  {
                    $or: [
                      { period_end_date: { $exists: false } },
                      { period_end_date: null },
                    ],
                  },
                  { month: targetMonth, year: targetYear },
                ],
              },
            ],
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "user_id",
            foreignField: "_id",
            as: "user",
          },
        },
        {
          $unwind: "$user",
        },
      ];

      // Filter by role
      if (role && ["seller_staff", "repository_staff"].includes(role)) {
        pipeline.push({ $match: { "user.role": role } });
      }

      // Search by name or email
      if (search) {
        pipeline.push({
          $match: {
            $or: [
              { "user.full_name": new RegExp(search, "i") },
              { "user.email": new RegExp(search, "i") },
            ],
          },
        });
      }

      // Facet for pagination
      pipeline.push({
        $facet: {
          metadata: [{ $count: "total" }],
          summary: [
            {
              $group: {
                _id: null,
                total_gross: { $sum: "$gross" },
                total_net: { $sum: "$net" },
                total_bonus: { $sum: "$total_bonus" },
                total_deductions: { $sum: "$total_deductions" },
                staff_count: { $sum: 1 },
              },
            },
          ],
          data: [
            { $sort: { "user.full_name": 1 } },
            { $skip: (parseInt(page) - 1) * parseInt(limit) },
            { $limit: parseInt(limit) },
            {
              $project: {
                _id: 1,
                month: 1,
                year: 1,
                period_start_date: 1,
                period_end_date: 1,
                total_work_hours: 1,
                total_work_days: 1,
                attendance_rate: 1,
                total_sales_amount: 1,
                total_orders_processed: 1,
                sales_commission: 1,
                base_salary: 1,
                hours_based_salary: 1,
                total_bonus: 1,
                total_deductions: 1,
                gross: 1,
                net: 1,
                payment_status: 1,
                user: {
                  _id: 1,
                  full_name: 1,
                  email: 1,
                  phone: 1,
                  role: 1,
                },
              },
            },
          ],
        },
      });

      const result = await Payslip.aggregate(pipeline);

      return {
        success: true,
        payslips: result[0]?.data || [],
        summary: result[0]?.summary[0] || {
          total_gross: 0,
          total_net: 0,
          total_bonus: 0,
          total_deductions: 0,
          staff_count: 0,
        },
        pagination: {
          total: result[0]?.metadata[0]?.total || 0,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(
            (result[0]?.metadata[0]?.total || 0) / parseInt(limit),
          ),
        },
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Add adjustment (bonus/deduction) to payslip
   */
  async addAdjustment(payslipId, adjustmentData, adminId) {
    try {
      const payslip = await Payslip.findById(payslipId);
      if (!payslip) {
        throw new Error("Payslip not found");
      }

      if (payslip.payment_status === "paid") {
        throw new Error("Cannot adjust a paid payslip");
      }

      const adjustment = {
        type: adjustmentData.type,
        amount: adjustmentData.amount,
        reason: adjustmentData.reason,
        created_by: adminId,
        created_at: new Date(),
      };

      payslip.adjustments.push(adjustment);

      // Recalculate totals
      const totalBonus = payslip.adjustments
        .filter((adj) => adj.type === "bonus")
        .reduce((sum, adj) => sum + adj.amount, 0);
      const totalDeductions = payslip.adjustments
        .filter((adj) => adj.type === "deduction")
        .reduce((sum, adj) => sum + adj.amount, 0);

      payslip.total_bonus = totalBonus;
      payslip.total_deductions = totalDeductions;
      payslip.gross =
        payslip.base_salary +
        payslip.hours_based_salary +
        payslip.sales_commission +
        totalBonus;
      payslip.net = payslip.gross - totalDeductions;

      await payslip.save();

      return {
        success: true,
        message: "Adjustment added successfully",
        payslip: await Payslip.findById(payslipId)
          .populate("user_id", "full_name email phone role")
          .populate("adjustments.created_by", "full_name"),
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Remove adjustment from payslip
   */
  async removeAdjustment(payslipId, adjustmentId) {
    try {
      const payslip = await Payslip.findById(payslipId);
      if (!payslip) {
        throw new Error("Payslip not found");
      }

      if (payslip.payment_status === "paid") {
        throw new Error("Cannot modify a paid payslip");
      }

      payslip.adjustments = payslip.adjustments.filter(
        (adj) => adj._id.toString() !== adjustmentId,
      );

      // Recalculate totals
      const totalBonus = payslip.adjustments
        .filter((adj) => adj.type === "bonus")
        .reduce((sum, adj) => sum + adj.amount, 0);
      const totalDeductions = payslip.adjustments
        .filter((adj) => adj.type === "deduction")
        .reduce((sum, adj) => sum + adj.amount, 0);

      payslip.total_bonus = totalBonus;
      payslip.total_deductions = totalDeductions;
      payslip.gross =
        payslip.base_salary +
        payslip.hours_based_salary +
        payslip.sales_commission +
        totalBonus;
      payslip.net = payslip.gross - totalDeductions;

      await payslip.save();

      return {
        success: true,
        message: "Adjustment removed successfully",
        payslip,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(payslipId, status, adminId) {
    try {
      const payslip = await Payslip.findById(payslipId);
      if (!payslip) {
        throw new Error("Payslip not found");
      }

      payslip.payment_status = status;
      if (status === "paid") {
        payslip.payment_date = new Date();
      }

      await payslip.save();

      return {
        success: true,
        message: `Payment status updated to ${status}`,
        payslip: await Payslip.findById(payslipId).populate(
          "user_id",
          "full_name email phone role",
        ),
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Bulk calculate payroll for all staff
   */
  async bulkCalculatePayroll(month, year, adminId, customConfig = {}) {
    try {
      const staffMembers = await User.find({
        role: { $in: ["seller_staff", "repository_staff"] },
        status: "active",
      });

      const results = [];
      const errors = [];

      for (const staff of staffMembers) {
        try {
          const result = await this.calculateStaffPayroll(
            staff._id,
            month,
            year,
            adminId,
            customConfig,
          );
          results.push({
            user_id: staff._id,
            full_name: staff.full_name,
            success: true,
          });
        } catch (error) {
          errors.push({
            user_id: staff._id,
            full_name: staff.full_name,
            error: error.message,
          });
        }
      }

      return {
        success: true,
        message: `Calculated payroll for ${results.length} staff members`,
        processed: results.length,
        failed: errors.length,
        results,
        errors,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Export payroll report to Excel
   */
  async exportToExcel(month, year, options = {}) {
    try {
      const normalizedOptions =
        typeof options === "string" ? { role: options } : options || {};
      const { role, search } = normalizedOptions;
      const targetMonth = parseInt(month);
      const targetYear = parseInt(year);
      const monthStart = new Date(targetYear, targetMonth - 1, 1);
      const monthEnd = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

      const pipeline = [
        {
          $match: {
            $or: [
              {
                period_start_date: { $exists: true, $ne: null, $gte: monthStart },
                period_end_date: { $exists: true, $ne: null, $lte: monthEnd },
              },
              {
                $and: [
                  {
                    $or: [
                      { period_start_date: { $exists: false } },
                      { period_start_date: null },
                    ],
                  },
                  {
                    $or: [
                      { period_end_date: { $exists: false } },
                      { period_end_date: null },
                    ],
                  },
                  { month: targetMonth, year: targetYear },
                ],
              },
            ],
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "user_id",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: "$user" },
      ];

      if (role) {
        pipeline.push({ $match: { "user.role": role } });
      }

      if (search) {
        pipeline.push({
          $match: {
            $or: [
              { "user.full_name": new RegExp(search, "i") },
              { "user.email": new RegExp(search, "i") },
            ],
          },
        });
      }

      pipeline.push({ $sort: { "user.full_name": 1 } });

      const payslips = await Payslip.aggregate(pipeline);

      const workbook = new ExcelJS.Workbook();
      const safeSheetName = `Payroll ${String(month).padStart(2, "0")}-${year}`;
      const worksheet = workbook.addWorksheet(safeSheetName);

      // Header
      worksheet.columns = [
        { header: "STT", key: "stt", width: 5 },
        { header: "Staff Name", key: "full_name", width: 25 },
        { header: "Role", key: "role", width: 15 },
        { header: "Work Days", key: "work_days", width: 12 },
        { header: "Work Hours", key: "work_hours", width: 12 },
        { header: "Attendance Rate (%)", key: "attendance_rate", width: 18 },
        { header: "Total Sales", key: "total_sales", width: 15 },
        { header: "Orders", key: "orders", width: 10 },
        { header: "Base Salary", key: "base_salary", width: 15 },
        { header: "Hours Salary", key: "hours_salary", width: 15 },
        { header: "Commission", key: "commission", width: 15 },
        { header: "Bonus", key: "bonus", width: 15 },
        { header: "Deductions", key: "deductions", width: 15 },
        { header: "Gross", key: "gross", width: 15 },
        { header: "Net", key: "net", width: 15 },
        { header: "Status", key: "status", width: 12 },
      ];

      // Style header
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      };

      // Add data
      payslips.forEach((payslip, index) => {
        worksheet.addRow({
          stt: index + 1,
          full_name: payslip.user.full_name,
          role: payslip.user.role === "seller_staff" ? "Seller" : "Repository",
          work_days: payslip.total_work_days,
          work_hours: payslip.total_work_hours,
          attendance_rate: payslip.attendance_rate,
          total_sales: payslip.total_sales_amount,
          orders: payslip.total_orders_processed,
          base_salary: payslip.base_salary,
          hours_salary: payslip.hours_based_salary,
          commission: payslip.sales_commission,
          bonus: payslip.total_bonus,
          deductions: payslip.total_deductions,
          gross: payslip.gross,
          net: payslip.net,
          status: payslip.payment_status,
        });
      });

      // Summary row
      const summaryRowNum = payslips.length + 3;
      worksheet.getCell(`A${summaryRowNum}`).value = "TOTAL";
      worksheet.getCell(`A${summaryRowNum}`).font = { bold: true };
      worksheet.getCell(`N${summaryRowNum}`).value = {
        formula: `SUM(N2:N${payslips.length + 1})`,
      };
      worksheet.getCell(`O${summaryRowNum}`).value = {
        formula: `SUM(O2:O${payslips.length + 1})`,
      };

      return workbook;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Export payroll report to PDF
   */
  async exportToPDF(month, year, options = {}) {
    try {
      const normalizedOptions =
        typeof options === "string" ? { role: options } : options || {};
      const { role, search } = normalizedOptions;
      const targetMonth = parseInt(month);
      const targetYear = parseInt(year);
      const monthStart = new Date(targetYear, targetMonth - 1, 1);
      const monthEnd = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

      const pipeline = [
        {
          $match: {
            $or: [
              {
                period_start_date: { $exists: true, $ne: null, $gte: monthStart },
                period_end_date: { $exists: true, $ne: null, $lte: monthEnd },
              },
              {
                $and: [
                  {
                    $or: [
                      { period_start_date: { $exists: false } },
                      { period_start_date: null },
                    ],
                  },
                  {
                    $or: [
                      { period_end_date: { $exists: false } },
                      { period_end_date: null },
                    ],
                  },
                  { month: targetMonth, year: targetYear },
                ],
              },
            ],
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "user_id",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: "$user" },
      ];

      if (role) {
        pipeline.push({ $match: { "user.role": role } });
      }

      if (search) {
        pipeline.push({
          $match: {
            $or: [
              { "user.full_name": new RegExp(search, "i") },
              { "user.email": new RegExp(search, "i") },
            ],
          },
        });
      }

      pipeline.push({ $sort: { "user.full_name": 1 } });

      const payslips = await Payslip.aggregate(pipeline);

      const doc = new PDFDocument({
        margin: 30,
        size: "A4",
        layout: "landscape",
      });

      // Title
      doc
        .fontSize(18)
        .text(`Payroll Report - ${month}/${year}`, { align: "center" });
      doc.moveDown();

      // Table header
      const tableTop = 100;
      const colWidths = [30, 120, 60, 50, 50, 50, 70, 70, 70, 70, 60];
      const headers = [
        "#",
        "Name",
        "Role",
        "Days",
        "Hours",
        "Att.%",
        "Base",
        "Commission",
        "Bonus",
        "Net",
        "Status",
      ];

      let x = 30;
      doc.fontSize(10).font("Helvetica-Bold");
      headers.forEach((header, i) => {
        doc.text(header, x, tableTop, { width: colWidths[i], align: "left" });
        x += colWidths[i];
      });

      // Table data
      doc.font("Helvetica");
      let y = tableTop + 20;

      payslips.forEach((payslip, index) => {
        if (y > 550) {
          doc.addPage();
          y = 50;
        }

        x = 30;
        const row = [
          (index + 1).toString(),
          payslip.user.full_name?.substring(0, 18) || "",
          payslip.user.role === "seller_staff" ? "Seller" : "Repo",
          payslip.total_work_days.toString(),
          payslip.total_work_hours.toFixed(1),
          payslip.attendance_rate.toFixed(0) + "%",
          this.formatCurrency(payslip.base_salary),
          this.formatCurrency(payslip.sales_commission),
          this.formatCurrency(payslip.total_bonus),
          this.formatCurrency(payslip.net),
          payslip.payment_status,
        ];

        row.forEach((cell, i) => {
          doc.text(cell, x, y, { width: colWidths[i], align: "left" });
          x += colWidths[i];
        });

        y += 18;
      });

      // Summary
      doc.moveDown(2);
      const totalNet = payslips.reduce((sum, p) => sum + p.net, 0);
      doc.fontSize(12).font("Helvetica-Bold");
      doc.text(
        `Total Staff: ${payslips.length} | Total Net Payroll: ${this.formatCurrency(totalNet)} VND`,
        { align: "right" },
      );

      doc.end();
      return doc;
    } catch (error) {
      throw error;
    }
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat("vi-VN").format(amount || 0);
  }

  /**
   * Get payslip detail
   */
  async getPayslipDetail(payslipId) {
    try {
      const payslip = await Payslip.findById(payslipId)
        .populate("user_id", "full_name email phone role avatar_url")
        .populate("adjustments.created_by", "full_name")
        .populate("created_by", "full_name");

      if (!payslip) {
        throw new Error("Payslip not found");
      }

      return {
        success: true,
        payslip,
      };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new PayrollAdminService();

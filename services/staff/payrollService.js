const Payslip = require("../../models/Payslip");
const StaffAttendance = require("../../models/StaffAttendance");
const Order = require("../../models/Order");
const mongoose = require("mongoose");

class StaffPayrollService {
  /**
   * Get own payroll list for a staff member
   */
  async getMyPayrollList(userId, options = {}) {
    try {
      const { year, page = 1, limit = 12 } = options;

      const query = { user_id: userId };
      if (year) {
        query.year = parseInt(year);
      }

      const total = await Payslip.countDocuments(query);

      const payslips = await Payslip.find(query)
        .select(
          "month year total_work_hours total_work_days attendance_rate total_sales_amount sales_commission base_salary hours_based_salary total_bonus total_deductions gross net payment_status payment_date createdAt",
        )
        .sort({ year: -1, month: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit));

      return {
        success: true,
        payslips,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get payslip detail for own payroll
   */
  async getMyPayslipDetail(userId, payslipId) {
    try {
      const payslip = await Payslip.findOne({
        _id: payslipId,
        user_id: userId,
      })
        .populate("adjustments.created_by", "full_name")
        .populate("created_by", "full_name");

      if (!payslip) {
        throw new Error("Payslip not found or unauthorized");
      }

      return {
        success: true,
        payslip,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get payroll summary for a staff member
   */
  async getMyPayrollSummary(userId, year) {
    try {
      const targetYear = year ? parseInt(year) : new Date().getFullYear();

      const pipeline = [
        {
          $match: {
            user_id: new mongoose.Types.ObjectId(userId),
            year: targetYear,
          },
        },
        {
          $group: {
            _id: null,
            total_gross: { $sum: "$gross" },
            total_net: { $sum: "$net" },
            total_bonus: { $sum: "$total_bonus" },
            total_deductions: { $sum: "$total_deductions" },
            total_work_hours: { $sum: "$total_work_hours" },
            total_work_days: { $sum: "$total_work_days" },
            total_sales: { $sum: "$total_sales_amount" },
            total_commission: { $sum: "$sales_commission" },
            months_worked: { $sum: 1 },
            paid_months: {
              $sum: { $cond: [{ $eq: ["$payment_status", "paid"] }, 1, 0] },
            },
            pending_months: {
              $sum: { $cond: [{ $eq: ["$payment_status", "pending"] }, 1, 0] },
            },
          },
        },
      ];

      const result = await Payslip.aggregate(pipeline);

      const summary = result[0] || {
        total_gross: 0,
        total_net: 0,
        total_bonus: 0,
        total_deductions: 0,
        total_work_hours: 0,
        total_work_days: 0,
        total_sales: 0,
        total_commission: 0,
        months_worked: 0,
        paid_months: 0,
        pending_months: 0,
      };

      // Calculate averages
      if (summary.months_worked > 0) {
        summary.avg_monthly_net = Math.round(
          summary.total_net / summary.months_worked,
        );
        summary.avg_work_hours =
          Math.round((summary.total_work_hours / summary.months_worked) * 100) /
          100;
        summary.avg_work_days =
          Math.round((summary.total_work_days / summary.months_worked) * 100) /
          100;
      } else {
        summary.avg_monthly_net = 0;
        summary.avg_work_hours = 0;
        summary.avg_work_days = 0;
      }

      summary.year = targetYear;

      return {
        success: true,
        summary,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get current month attendance summary
   */
  async getMyCurrentMonthAttendance(userId) {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );

      const attendances = await StaffAttendance.find({
        user_id: userId,
        check_in_time: { $gte: startOfMonth, $lte: endOfMonth },
      }).sort({ check_in_time: -1 });

      let totalWorkHours = 0;
      let totalWorkDays = 0;

      for (const attendance of attendances) {
        if (
          attendance.status === "checked_out" &&
          attendance.check_in_time &&
          attendance.check_out_time
        ) {
          const hours =
            (attendance.check_out_time - attendance.check_in_time) /
            (1000 * 60 * 60);
          totalWorkHours += Math.min(hours, 12);
          totalWorkDays++;
        }
      }

      return {
        success: true,
        attendance: {
          month: now.getMonth() + 1,
          year: now.getFullYear(),
          total_work_hours: Math.round(totalWorkHours * 100) / 100,
          total_work_days: totalWorkDays,
          attendance_records: attendances.length,
          records: attendances.slice(0, 10), // Last 10 records
        },
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get current month sales summary (for seller_staff)
   */
  async getMyCurrentMonthSales(userId) {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );

      const pipeline = [
        {
          $match: {
            staff_id: new mongoose.Types.ObjectId(userId),
            created_at: { $gte: startOfMonth, $lte: endOfMonth },
          },
        },
        {
          $group: {
            _id: "$order_status",
            count: { $sum: 1 },
            total_amount: { $sum: "$final_amount" },
          },
        },
      ];

      const result = await Order.aggregate(pipeline);

      const salesSummary = {
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        total_orders: 0,
        completed_orders: 0,
        pending_orders: 0,
        cancelled_orders: 0,
        total_sales_amount: 0,
        completed_amount: 0,
      };

      for (const item of result) {
        salesSummary.total_orders += item.count;
        if (item._id === "completed") {
          salesSummary.completed_orders = item.count;
          salesSummary.completed_amount = item.total_amount;
        } else if (item._id === "pending" || item._id === "processing") {
          salesSummary.pending_orders += item.count;
        } else if (item._id === "cancelled") {
          salesSummary.cancelled_orders = item.count;
        }
        salesSummary.total_sales_amount += item.total_amount;
      }

      return {
        success: true,
        sales: salesSummary,
      };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new StaffPayrollService();

const mongoose = require("mongoose");

// Schema for individual adjustments (bonus/deduction)
const adjustmentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["bonus", "deduction"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    reason: {
      type: String,
      maxlength: 500,
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true },
);

const payslipSchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      auto: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    month: {
      type: Number,
      min: 1,
      max: 12,
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
    // Working hours data
    total_work_hours: {
      type: Number,
      default: 0,
    },
    total_work_days: {
      type: Number,
      default: 0,
    },
    hourly_rate: {
      type: Number,
      default: 0,
    },
    // Attendance data
    attendance_rate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    // Sales performance (for seller_staff)
    total_sales_amount: {
      type: Number,
      default: 0,
    },
    total_orders_processed: {
      type: Number,
      default: 0,
    },
    sales_commission_rate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    sales_commission: {
      type: Number,
      default: 0,
    },
    // Salary breakdown
    base_salary: {
      type: Number,
      default: 0,
    },
    hours_based_salary: {
      type: Number,
      default: 0,
    },
    // Adjustments list
    adjustments: [adjustmentSchema],
    // Totals
    total_bonus: {
      type: Number,
      default: 0,
    },
    total_deductions: {
      type: Number,
      default: 0,
    },
    gross: {
      type: Number,
      default: 0,
    },
    net: {
      type: Number,
      default: 0,
    },
    payment_status: {
      type: String,
      enum: ["pending", "paid"],
      default: "pending",
    },
    payment_date: {
      type: Date,
    },
    notes: {
      type: String,
      maxlength: 1000,
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  },
);

// Prevent duplicate payslip for same user/month/year
payslipSchema.index({ user_id: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model("Payslip", payslipSchema);

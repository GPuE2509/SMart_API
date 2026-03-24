const express = require("express");
const router = express.Router();
const payrollController = require("../../controllers/staff/payrollController");
const {
  authenticateUser,
  isStaff,
} = require("../../middleware/authMiddleware");

// All routes require authentication and staff role
router.use(authenticateUser);
router.use(isStaff);

// GET /api/v1/staff/payroll/summary - Get yearly payroll summary
router.get("/summary", payrollController.getMyPayrollSummary);

// GET /api/v1/staff/payroll/attendance - Get current month attendance
router.get("/attendance", payrollController.getMyCurrentMonthAttendance);

// GET /api/v1/staff/payroll/sales - Get current month sales (seller_staff only)
router.get("/sales", payrollController.getMyCurrentMonthSales);

// GET /api/v1/staff/payroll - Get own payroll list
router.get("/", payrollController.getMyPayrollList);

// GET /api/v1/staff/payroll/:payslipId - Get payslip detail
router.get("/:payslipId", payrollController.getMyPayslipDetail);

module.exports = router;

const express = require("express");
const router = express.Router();
const payrollController = require("../../controllers/admin/payrollController");
const {
  authenticateUser,
  isAdmin,
} = require("../../middleware/authMiddleware");

// All routes require authentication and admin role
router.use(authenticateUser);
router.use(isAdmin);

// POST /api/v1/admin/payroll/calculate - Calculate payroll for single staff
router.post("/calculate", payrollController.calculatePayroll);

// POST /api/v1/admin/payroll/calculate-all - Bulk calculate payroll for all staff
router.post("/calculate-all", payrollController.bulkCalculatePayroll);

// GET /api/v1/admin/payroll/report - Get payroll report
router.get("/report", payrollController.getPayrollReport);

// GET /api/v1/admin/payroll/export/excel - Export to Excel
router.get("/export/excel", payrollController.exportToExcel);

// GET /api/v1/admin/payroll/export/pdf - Export to PDF
router.get("/export/pdf", payrollController.exportToPDF);

// GET /api/v1/admin/payroll/:payslipId - Get payslip detail
router.get("/:payslipId", payrollController.getPayslipDetail);

// POST /api/v1/admin/payroll/:payslipId/adjustment - Add adjustment
router.post("/:payslipId/adjustment", payrollController.addAdjustment);

// DELETE /api/v1/admin/payroll/:payslipId/adjustment/:adjustmentId - Remove adjustment
router.delete(
  "/:payslipId/adjustment/:adjustmentId",
  payrollController.removeAdjustment,
);

// PATCH /api/v1/admin/payroll/:payslipId/status - Update payment status
router.patch("/:payslipId/status", payrollController.updatePaymentStatus);

module.exports = router;

const express = require("express");
const router = express.Router();
const salesReportController = require("../../controllers/admin/salesReportController");
const {
  authenticateUser,
  authorizeRoles,
} = require("../../middleware/authMiddleware");

/**
 * @route   GET /api/v1/admin/reports/revenue-profit
 * @desc    Get Revenue & Profit Chart data (Combo Chart)
 * @access  Admin only
 * @query   period (day|week|month), start_date, end_date
 */
router.get(
  "/revenue-profit",
  authenticateUser,
  authorizeRoles("admin"),
  salesReportController.getRevenueAndProfitChart,
);

/**
 * @route   GET /api/v1/admin/reports/top-products
 * @desc    Get Top Selling Products (Horizontal Bar Chart)
 * @access  Admin only
 * @query   limit, start_date, end_date
 */
router.get(
  "/top-products",
  authenticateUser,
  authorizeRoles("admin"),
  salesReportController.getTopSellingProducts,
);

/**
 * @route   GET /api/v1/admin/reports/peak-hours
 * @desc    Get Peak Hours Heatmap data
 * @access  Admin only
 * @query   start_date, end_date
 */
router.get(
  "/peak-hours",
  authenticateUser,
  authorizeRoles("admin"),
  salesReportController.getPeakHoursHeatmap,
);

/**
 * @route   GET /api/v1/admin/reports/summary
 * @desc    Get Overall Sales Summary
 * @access  Admin only
 * @query   start_date, end_date
 */
router.get(
  "/summary",
  authenticateUser,
  authorizeRoles("admin"),
  salesReportController.getSalesSummary,
);

module.exports = router;

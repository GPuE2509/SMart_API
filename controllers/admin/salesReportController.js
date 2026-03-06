const salesReportService = require("../../services/admin/salesReportService");

/**
 * Get Revenue & Profit Chart over Time
 * GET /api/v1/admin/reports/revenue-profit
 * Query params: period (day|week|month), start_date, end_date
 */
exports.getRevenueAndProfitChart = async (req, res) => {
  try {
    const result = await salesReportService.getRevenueAndProfitChart(req.query);

    res.json({
      success: true,
      message: "Lấy dữ liệu biểu đồ doanh thu và lợi nhuận thành công",
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Không thể lấy dữ liệu báo cáo",
      error: error.message,
    });
  }
};

/**
 * Get Top Selling Products (Best Sellers)
 * GET /api/v1/admin/reports/top-products
 * Query params: limit, start_date, end_date
 */
exports.getTopSellingProducts = async (req, res) => {
  try {
    const result = await salesReportService.getTopSellingProducts(req.query);

    res.json({
      success: true,
      message: "Lấy danh sách sản phẩm bán chạy thành công",
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách sản phẩm bán chạy",
      error: error.message,
    });
  }
};

/**
 * Get Peak Hours Heatmap
 * GET /api/v1/admin/reports/peak-hours
 * Query params: start_date, end_date
 */
exports.getPeakHoursHeatmap = async (req, res) => {
  try {
    const result = await salesReportService.getPeakHoursHeatmap(req.query);

    res.json({
      success: true,
      message: "Lấy dữ liệu heatmap giờ cao điểm thành công",
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Không thể lấy dữ liệu giờ cao điểm",
      error: error.message,
    });
  }
};

/**
 * Get Overall Sales Summary
 * GET /api/v1/admin/reports/summary
 * Query params: start_date, end_date
 */
exports.getSalesSummary = async (req, res) => {
  try {
    const result = await salesReportService.getSalesSummary(req.query);

    res.json({
      success: true,
      message: "Lấy tổng quan báo cáo bán hàng thành công",
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Không thể lấy tổng quan báo cáo",
      error: error.message,
    });
  }
};

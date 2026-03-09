const salesReportService = require("../../services/admin/salesReportService");
const financeReportService = require("../../services/admin/financeReportService");

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

/**
 * Get Rescue Efficiency Report
 * GET /api/v1/admin/reports/rescue-efficiency
 * Query params: start_date, end_date
 */
exports.getRescueEfficiencyReport = async (req, res) => {
  try {
    const result = await salesReportService.getRescueEfficiencyReport(req.query);

    res.json({
      success: true,
      message: "Lấy báo cáo hiệu quả cứu hàng thành công",
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Không thể lấy báo cáo hiệu quả cứu hàng",
      error: error.message,
    });
  }
};

/**
 * Get Cash Flow Chart (inflows: sales, outflows: inventory + operations)
 * GET /api/v1/admin/reports/cash-flow
 * Query params: period (day|week|month), start_date, end_date
 */
exports.getCashFlowChart = async (req, res) => {
  try {
    const result = await financeReportService.getCashFlowChart(req.query);

    res.json({
      success: true,
      message: "Lấy dữ liệu biểu đồ dòng tiền thành công",
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Không thể lấy dữ liệu dòng tiền",
      error: error.message,
    });
  }
};

/**
 * Get Cost vs Retail Price Trend Chart (multi-line: avg cost vs avg retail)
 * GET /api/v1/admin/reports/cost-retail-trend
 * Query params: period (day|week|month), start_date, end_date
 */
exports.getCostRetailTrendChart = async (req, res) => {
  try {
    const result = await financeReportService.getCostRetailTrendChart(req.query);

    res.json({
      success: true,
      message: "Lấy dữ liệu xu hướng giá vốn & giá bán thành công",
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Không thể lấy dữ liệu xu hướng giá",
      error: error.message,
    });
  }
};

const couponService = require("../../services/admin/couponService");

/**
 * Get all coupons with filters and pagination
 * GET /api/v1/coupons
 * Query params: code, status, discount_type, sort_by, sort_order, page, limit
 */
exports.getAll = async (req, res) => {
  try {
    const result = await couponService.getAllCoupons(req.query);

    res.json({
      success: true,
      data: result.coupons,
      pagination: result.pagination,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get coupon by ID
 * GET /api/v1/coupons/:id
 */
exports.getById = async (req, res) => {
  try {
    const coupon = await couponService.getCouponById(req.params.id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy coupon",
      });
    }

    res.status(200).json({
      success: true,
      message: "Lấy thông tin coupon thành công",
      data: coupon,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Không thể lấy thông tin coupon",
      error: error.message,
    });
  }
};

/**
 * Create new coupon
 * POST /api/v1/coupons
 * Body: code, description, discount_type, discount_value, min_order_value, max_discount_amount, start_date, end_date, quantity_limit, points_required, status
 */
exports.create = async (req, res) => {
  try {
    const coupon = await couponService.createCoupon(req.body);

    res.status(201).json({
      success: true,
      message: "Tạo coupon thành công",
      data: coupon,
    });
  } catch (error) {
    // Handle validation errors
    if (
      error.message.includes("là bắt buộc") ||
      error.message.includes("không hợp lệ") ||
      error.message.includes("đã tồn tại") ||
      error.message.includes("không thể lớn hơn") ||
      error.message.includes("phải lớn hơn") ||
      error.message.includes("phải trước")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Không thể tạo coupon",
      error: error.message,
    });
  }
};

/**
 * Update coupon
 * PUT /api/v1/coupons/:id
 * Body: code, description, discount_type, discount_value, min_order_value, max_discount_amount, start_date, end_date, quantity_limit, points_required, status
 */
exports.update = async (req, res) => {
  try {
    const { id } = req.params;

    const coupon = await couponService.updateCoupon(id, req.body);

    res.status(200).json({
      success: true,
      message: "Cập nhật coupon thành công",
      data: coupon,
    });
  } catch (error) {
    if (error.message === "Không tìm thấy coupon") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    // Handle validation errors
    if (
      error.message.includes("không hợp lệ") ||
      error.message.includes("đã tồn tại") ||
      error.message.includes("không thể lớn hơn") ||
      error.message.includes("phải lớn hơn") ||
      error.message.includes("phải trước")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
// Handle case where no fields are provided for update
    res.status(500).json({
      success: false,
      message: "Không thể cập nhật coupon",
      error: error.message,
    });
  }
};

/**
 * Delete coupon
 * DELETE /api/v1/coupons/:id
 */
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;

    await couponService.deleteCoupon(id);

    res.status(200).json({
      success: true,
      message: "Xóa coupon thành công",
    });
  } catch (error) {
    if (error.message === "Không tìm thấy coupon") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Không thể xóa coupon",
      error: error.message,
    });
  }
};

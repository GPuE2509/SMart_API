const orderService = require("../../services/admin/orderService");

/**
 * Get all orders for admin order management view.
 * GET /api/v1/admin/orders
 * Query params: page, limit
 */
exports.getAll = async (req, res) => {
  try {
    const result = await orderService.getAllOrders(req.query);

    res.status(200).json({
      success: true,
      data: result.orders,
      pagination: result.pagination,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Không thể tải danh sách đơn hàng",
      error: error.message,
    });
  }
};

/**
 * Manually confirm payment status for an order.
 * PATCH /api/v1/admin/orders/:id/confirm-payment
 */
exports.confirmPayment = async (req, res) => {
  try {
    const order = await orderService.confirmOrderPayment(req.params.id);

    res.status(200).json({
      success: true,
      message: "Xác nhận thanh toán thành công",
      data: order,
    });
  } catch (error) {
    const statusCode =
      error.message === "Không tìm thấy đơn hàng"
        ? 404
        : error.message === "Chỉ có thể xác nhận thanh toán cho đơn chưa thanh toán"
          ? 400
          : 500;

    res.status(statusCode).json({
      success: false,
      message:
        statusCode === 500 ? "Không thể xác nhận trạng thái thanh toán" : error.message,
      error: statusCode === 500 ? error.message : undefined,
    });
  }
};

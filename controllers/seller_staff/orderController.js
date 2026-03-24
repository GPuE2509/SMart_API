const orderService = require("../../services/seller_staff/orderService");

class SellerStaffOrderController {
  /**
   * GET /api/v1/seller-staff/orders
   * Get list of orders with pagination and filters
   */
  async getOrderList(req, res) {
    try {
      const {
        page,
        limit,
        order_code,
        phone,
        min_amount,
        max_amount,
        start_date,
        end_date,
        order_status,
        payment_status,
        order_type,
        barcode,
        sort_by,
        sort_order,
      } = req.query;

      const result = await orderService.getOrderList({
        page,
        limit,
        order_code,
        phone,
        min_amount,
        max_amount,
        start_date,
        end_date,
        order_status,
        payment_status,
        order_type,
        barcode,
        sort_by,
        sort_order,
      });

      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * GET /api/v1/seller-staff/orders/:orderId
   * Get order detail by ID
   */
  async getOrderDetail(req, res) {
    try {
      const { orderId } = req.params;

      if (!orderId) {
        return res.status(400).json({
          success: false,
          message: "Order ID is required",
        });
      }

      const result = await orderService.getOrderDetail(orderId);
      return res.status(200).json(result);
    } catch (error) {
      if (error.message === "Order not found") {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * GET /api/v1/seller-staff/orders/scan/:barcode
   * Search orders by product barcode (scan)
   */
  async searchByBarcode(req, res) {
    try {
      const { barcode } = req.params;

      if (!barcode) {
        return res.status(400).json({
          success: false,
          message: "Barcode is required",
        });
      }

      const result = await orderService.searchByBarcode(barcode);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * GET /api/v1/seller-staff/orders/stats
   * Get order statistics
   */
  async getOrderStats(req, res) {
    try {
      const { start_date, end_date } = req.query;
      // Show all orders stats for seller staff dashboard (not filtered by staff_id)
      // If you want to show only orders by this staff, pass staffId
      const staffId = null; // Show all orders

      const result = await orderService.getOrderStats(
        staffId,
        start_date,
        end_date,
      );
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
}

module.exports = new SellerStaffOrderController();

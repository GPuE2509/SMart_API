const orderService = require("../../services/customer/orderService");

class OrderController {
  // Create new order
  async createOrder(req, res) {
    try {
      const userId = req.user.id; // From auth middleware
      const orderData = req.body;

      // Validate request
      if (!orderData.items || orderData.items.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Order items are required",
        });
      }

      // Create order
      const order = await orderService.createOrder(userId, orderData);

      res.status(201).json({
        success: true,
        message: "Order created successfully",
        data: order,
      });
    } catch (error) {
      console.error("Create order error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to create order",
      });
    }
  }

  // Create PayOS payment link
  async createPayOSPayment(req, res) {
    try {
      const { orderId } = req.body;
      const userId = req.user.id;

      if (!orderId) {
        return res.status(400).json({
          success: false,
          message: "Order ID is required",
        });
      }

      // Verify order belongs to user
      const { order } = await orderService.getOrderById(orderId, userId);

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      // Create payment link
      const paymentLink = await orderService.createPayOSPayment(orderId);

      res.status(200).json({
        success: true,
        message: "Payment link created successfully",
        data: paymentLink,
      });
    } catch (error) {
      console.error("Create PayOS payment error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to create payment link",
      });
    }
  }

  // Get order by ID
  async getOrderById(req, res) {
    try {
      const { orderId } = req.params;
      const userId = req.user.id;

      const result = await orderService.getOrderById(orderId, userId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("Get order error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get order",
      });
    }
  }

  async getReorderPreview(req, res) {
    try {
      const { orderId } = req.params;
      const userId = req.user.id;

      const result = await orderService.getReorderPreview(userId, orderId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("Get reorder preview error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to load reorder preview",
      });
    }
  }

  // Reorder: add previous order items back to cart
  async reorderOrder(req, res) {
    try {
      const { orderId } = req.params;
      const userId = req.user.id;

      const result = await orderService.reorderOrder(userId, orderId);

      res.status(200).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (error) {
      console.error("Reorder error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to reorder",
      });
    }
  }

  // Get user orders (query: page, limit, order_code, date_from, date_to, order_status)
  async getUserOrders(req, res) {
    try {
      const userId = req.user.id;
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const orderCode = typeof req.query.order_code === "string" ? req.query.order_code.trim() : "";
      const dateFrom = req.query.date_from || null;
      const dateTo = req.query.date_to || null;
      const orderStatus = typeof req.query.order_status === "string" ? req.query.order_status.trim() : "all";

      const filters = { order_code: orderCode, date_from: dateFrom, date_to: dateTo, order_status: orderStatus };
      const result = await orderService.getUserOrders(userId, page, limit, filters);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("Get user orders error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get orders",
      });
    }
  }

  // Check payment status
  async checkPaymentStatus(req, res) {
    try {
      const { orderId } = req.params;
      const userId = req.user.id;

      // Check and update payment status from PayOS
      const order = await orderService.checkAndUpdatePaymentStatus(
        orderId,
        userId,
      );

      res.status(200).json({
        success: true,
        data: {
          order_id: order._id,
          order_code: order.order_code,
          payment_status: order.payment_status,
          order_status: order.order_status,
          final_amount: order.final_amount,
        },
      });
    } catch (error) {
      console.error("Check payment status error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to check payment status",
      });
    }
  }
}

module.exports = new OrderController();

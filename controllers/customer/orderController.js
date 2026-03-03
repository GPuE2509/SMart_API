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

  // PayOS webhook handler
  async handlePayOSWebhook(req, res) {
    try {
      const webhookData = req.body;

      console.log("PayOS Webhook received:", webhookData);

      // Verify and process payment
      const order = await orderService.verifyPayOSWebhook(webhookData);

      if (order) {
        console.log(
          "Payment verified successfully for order:",
          order.order_code,
        );

        return res.status(200).json({
          success: true,
          message: "Webhook processed successfully",
          data: order,
        });
      }

      res.status(200).json({
        success: true,
        message: "Webhook received but payment not completed",
      });
    } catch (error) {
      console.error("PayOS webhook error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Webhook processing failed",
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

  // Get user orders
  async getUserOrders(req, res) {
    try {
      const userId = req.user.id;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;

      const result = await orderService.getUserOrders(userId, page, limit);

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

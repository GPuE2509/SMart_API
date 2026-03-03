const Order = require("../../models/Order");
const OrderDetail = require("../../models/OrderDetail");
const ProductBatch = require("../../models/ProductBatch");
const ProductUnit = require("../../models/ProductUnit");
const User = require("../../models/User");
const { payos } = require("../../config/payment");
const mongoose = require("mongoose");

class OrderService {
  // Generate unique order code
  generateOrderCode() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `ORD${timestamp}${random}`;
  }

  // Create new order
  async createOrder(userId, orderData) {
    try {
      const { items, couponCode, paymentMethod } = orderData;

      // Validate user
      const user = await User.findById(userId);
      if (!user) {
        throw new Error("User not found");
      }

      // Calculate totals
      let totalAmount = 0;
      const orderItems = [];

      for (const item of items) {
        const productUnit = await ProductUnit.findById(item.product_unit_id)
          .populate("product_id")
          .populate("unit_id");

        if (!productUnit) {
          throw new Error(`Product unit not found: ${item.product_unit_id}`);
        }

        if (!productUnit.unit_id) {
          throw new Error(
            `Unit not found for product: ${productUnit.product_id.name}`,
          );
        }

        // Find available batch with matching product and unit
        // ProductBatch has nested items array structure
        const batch = await ProductBatch.findOne({
          "items.product_id": productUnit.product_id._id,
          "items.unit_id": productUnit.unit_id._id,
          "items.current_quantity": { $gte: item.quantity },
          "items.status": "instock",
          is_deleted: false,
        }).sort({ created_at: 1 });

        if (!batch) {
          throw new Error(
            `Not enough stock for product: ${productUnit.product_id.name}`,
          );
        }

        // Find the specific item within batch
        const batchItem = batch.items.find(
          (bItem) =>
            bItem.product_id.toString() ===
              productUnit.product_id._id.toString() &&
            bItem.unit_id.toString() === productUnit.unit_id._id.toString() &&
            bItem.current_quantity >= item.quantity &&
            bItem.status === "instock",
        );

        if (!batchItem) {
          throw new Error(
            `No available batch item for product: ${productUnit.product_id.name}`,
          );
        }

        const itemTotal = productUnit.price * item.quantity;
        totalAmount += itemTotal;

        orderItems.push({
          product_unit_id: item.product_unit_id,
          product_batch_id: batch._id,
          batch_item_id: batchItem._id, // Store the specific item ID
          quantity: item.quantity,
          unit_price: productUnit.price,
          total_price: itemTotal,
        });
      }

      // Calculate tax (10%)
      const taxAmount = totalAmount * 0.1;
      const finalAmount = totalAmount + taxAmount;

      // Create order
      const orderCode = this.generateOrderCode();
      const order = new Order({
        order_code: orderCode,
        user_id: userId,
        total_amount: totalAmount,
        tax_amount: taxAmount,
        final_amount: finalAmount,
        payment_method: paymentMethod,
        payment_status: "unpaid",
        order_status: "pending",
        order_type: "online",
      });

      await order.save();

      // Create order details
      for (const item of orderItems) {
        const orderDetail = new OrderDetail({
          order_id: order._id,
          ...item,
        });
        await orderDetail.save();

        // Update batch item quantity (nested array structure)
        await ProductBatch.updateOne(
          {
            _id: item.product_batch_id,
            "items._id": item.batch_item_id,
          },
          {
            $inc: { "items.$.current_quantity": -item.quantity },
          },
        );
      }

      return order;
    } catch (error) {
      throw error;
    }
  }

  // Create PayOS payment link
  async createPayOSPayment(orderId) {
    try {
      const order = await Order.findById(orderId).populate(
        "user_id",
        "username email",
      );

      if (!order) {
        throw new Error("Order not found");
      }

      if (order.payment_status === "paid") {
        throw new Error("Order already paid");
      }

      // Get order details
      const orderDetails = await OrderDetail.find({
        order_id: orderId,
      }).populate({
        path: "product_unit_id",
        populate: { path: "product_id" },
      });

      // Prepare items for PayOS
      const items = orderDetails.map((detail) => ({
        name: detail.product_unit_id.product_id.name,
        quantity: detail.quantity,
        price: Math.round(detail.unit_price),
      }));

      // Create payment data
      const paymentData = {
        orderCode: Number(Date.now()), // PayOS requires number
        amount: Math.round(order.final_amount),
        description: `DH ${order.order_code.slice(-8)}`, // Max 25 chars
        items: items,
        returnUrl: process.env.PAYOS_RETURN_URL,
        cancelUrl: process.env.PAYOS_CANCEL_URL,
      };

      // Create payment link via PayOS
      const paymentLink = await payos.paymentRequests.create(paymentData);

      // Save PayOS orderCode to order for later verification
      order.payos_order_code = paymentData.orderCode;
      await order.save();

      return {
        checkoutUrl: paymentLink.checkoutUrl,
        qrCode: paymentLink.qrCode,
        paymentLinkId: paymentLink.paymentLinkId,
      };
    } catch (error) {
      throw error;
    }
  }

  // Verify PayOS payment via webhook
  async verifyPayOSWebhook(webhookData) {
    try {
      const { orderCode, amount, description, code, id } = webhookData;

      // Get payment info from PayOS
      const paymentInfo = await payos.paymentRequests.get(id);

      if (paymentInfo.status === "PAID") {
        // Find order by PayOS orderCode
        const order = await Order.findOne({ payos_order_code: orderCode });

        if (!order) {
          throw new Error("Order not found");
        }

        // Update order status
        order.payment_status = "paid";
        order.order_status = "processing";
        await order.save();

        return order;
      }

      return null;
    } catch (error) {
      throw error;
    }
  }

  // Get order by ID
  async getOrderById(orderId, userId) {
    const order = await Order.findOne({ _id: orderId, user_id: userId })
      .populate("user_id", "username email")
      .populate("coupon_id");

    if (!order) {
      throw new Error("Order not found");
    }

    const orderDetails = await OrderDetail.find({ order_id: orderId }).populate(
      {
        path: "product_unit_id",
        populate: { path: "product_id unit_id" },
      },
    );

    return { order, orderDetails };
  }

  // Check and update PayOS payment status
  async checkAndUpdatePaymentStatus(orderId, userId) {
    try {
      const order = await Order.findOne({ _id: orderId, user_id: userId });

      if (!order) {
        throw new Error("Order not found");
      }

      // Only check PayOS orders that are unpaid
      if (
        order.payment_method === "payos" &&
        order.payment_status === "unpaid"
      ) {
        if (!order.payos_order_code) {
          throw new Error("PayOS order code not found");
        }

        try {
          // Get payment status from PayOS
          const paymentInfo = await payos.paymentRequests.get(
            order.payos_order_code,
          );

          // Update order if paid
          if (paymentInfo.status === "PAID") {
            order.payment_status = "paid";
            order.order_status = "processing";
            await order.save();
          }
        } catch (payosError) {
          console.error("PayOS API error:", payosError.message);
          // Don't throw error, just return current order status
        }
      }

      return order;
    } catch (error) {
      throw error;
    }
  }

  // Get user orders
  async getUserOrders(userId, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const orders = await Order.find({ user_id: userId })
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate("coupon_id");

    const total = await Order.countDocuments({ user_id: userId });

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

module.exports = new OrderService();

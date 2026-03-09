const Order = require("../../models/Order");
const OrderDetail = require("../../models/OrderDetail");
const ProductBatch = require("../../models/ProductBatch");
const ProductUnit = require("../../models/ProductUnit");
const Product = require("../../models/Product");
const User = require("../../models/User");
const { payos } = require("../../config/payment");
const mongoose = require("mongoose");

/**
 * Remove Vietnamese diacritics for search
 */
const removeVietnameseDiacritics = (str) => {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
};

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
      let taxAmount = 0;
      const orderItems = [];

      for (const item of items) {
        const productUnit = await ProductUnit.findById(item.product_unit_id)
          .populate("product_id")
          .populate("unit_id");

        if (!productUnit) {
          throw new Error(`Sản phẩm không có sẵn: ID ${item.product_unit_id}`);
        }

        if (!productUnit.unit_id) {
          throw new Error(
            `Đơn vị tính bị lỗi đối với sản phẩm: ${productUnit.product_id.name}`,
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
            `Xin lỗi, sản phẩm ${productUnit.product_id.name} hiện tại đã hết hàng trong kho.`,
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
            `Xin lỗi! Sản phẩm "${productUnit.product_id.name}" không còn đủ ${item.quantity} phần trong lô hàng hiện tại. Bạn vui lòng giảm số lượng.`,
          );
        }

        const itemTotal = productUnit.price * item.quantity;
        totalAmount += itemTotal;

        // Calculate tax based on product's tax_percentage
        const itemTaxPercentage = productUnit.product_id.tax_percentage || 0;
        const itemTax = (itemTotal * itemTaxPercentage) / 100;
        taxAmount += itemTax;

        orderItems.push({
          product_unit_id: item.product_unit_id,
          product_batch_id: batch._id,
          batch_item_id: batchItem._id, // Store the specific item ID
          quantity: item.quantity,
          unit_price: productUnit.price,
          total_price: itemTotal,
          // Store for updating product total_stock
          product_id: productUnit.product_id._id,
          exchange_value: productUnit.exchange_value,
        });
      }

      // Calculate final amount
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
          product_unit_id: item.product_unit_id,
          product_batch_id: item.product_batch_id,
          batch_item_id: item.batch_item_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
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

        // Update product total_stock (convert to base unit)
        const product = await Product.findById(item.product_id);
        if (product) {
          const quantityInBaseUnit = item.quantity * item.exchange_value;
          product.total_stock = Math.max(
            0,
            (product.total_stock || 0) - quantityInBaseUnit,
          );
          await product.save();
        }
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


  // ==================== AUTO CRON PAYOS ====================
  // Hàm quét tự động tìm mấy ông nội treo PayOS quá 15 phút
  async autoCancelExpiredPayOSOrders() {
    try {
      // 1. Tạo cái mốc thời gian cách đây 15 phút
      const timeoutDate = new Date(Date.now() - 15 * 60 * 1000);

      // 2. Lục tìm mấy đơn PayOS đang treo
      const expiredOrders = await Order.find({
        payment_method: "payos",
        payment_status: "unpaid",
        order_status: "pending",
        created_at: { $lt: timeoutDate } // Lọc ngày rành rành cũ hơn 15phút
      });

      if (expiredOrders.length === 0) return; // Không có rác thì quay đầu

      // 3. Có rác thì lôi ra xử từng ông một
      for (const order of expiredOrders) {
        
        // --- BƯỚC 3A: Đánh dấu đơn là ĐÃ HỦY do quá hạn ---
        order.order_status = "cancelled";
        // Ghi chú lý do hủy
        order.cancellation_reason = "System timeout: Unpaid PayOS order";
        await order.save();

        // --- BƯỚC 3B: Moi lại cái hóa đơn chi tiết để coi hồi nãy trừ mấy món đồ ---
        const details = await OrderDetail.find({ order_id: order._id }).populate("product_unit_id");

        for (const item of details) {
          if (!item.product_batch_id || !item.batch_item_id) continue;

          // Cộng ngược đồ đạc về kho (ProductBatch)
          await ProductBatch.updateOne(
            {
              _id: item.product_batch_id,
              "items._id": item.batch_item_id
            },
            { $inc: { "items.$.current_quantity": item.quantity } } // Lệnh $inc để cộng số dương
          );

          // Nhớ cộng lại tổng hiển thị kho ảo (Product.total_stock)
          const productUnit = item.product_unit_id;
          if (productUnit && productUnit.product_id) {
            const product = await Product.findById(productUnit.product_id);
            if (product) {
              const quantityInBaseUnit = item.quantity * (productUnit.exchange_value || 1);
              product.total_stock = (product.total_stock || 0) + quantityInBaseUnit;
              await product.save();
            }
          }
        }
        
        console.log(`[Auto-Cron] Đã HỦY và NHẢ KHO cho đơn mồ côi: ${order.order_code}`);
      }
    } catch (error) {
      console.error("[Auto-Cron] Lỗi khi chạy quét rác tự động:", error);
    }
  }
}

module.exports = new OrderService();

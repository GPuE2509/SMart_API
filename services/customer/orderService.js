const Order = require("../../models/Order");
const OrderDetail = require("../../models/OrderDetail");
const CartItem = require("../../models/CartItem");
const ProductBatch = require("../../models/ProductBatch");
const ProductUnit = require("../../models/ProductUnit");
const Product = require("../../models/Product");
const User = require("../../models/User");
const Coupon = require("../../models/Coupon");
const UserCoupon = require("../../models/UserCoupon");
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
          "items.status": "onsale",
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
            bItem.status === "onsale",
        );

        if (!batchItem) {
          throw new Error(
            `Xin lỗi! Sản phẩm "${productUnit.product_id.name}" không còn đủ ${item.quantity} phần trong lô hàng hiện tại. Bạn vui lòng giảm số lượng.`,
          );
        }

        // Apply active discount policy: rescue pricing (auto) or manual discount.
        let finalUnitPrice = productUnit.price;
        let rescuePricing = {
          isRescuePricing: false,
          originalPrice: productUnit.price,
          discountPercentage: 0,
          discountAmount: 0,
        };

        if (
          batchItem.rescue_pricing_enabled &&
          batchItem.rescue_pricing_active &&
          batchItem.rescue_discount_percentage > 0
        ) {
          rescuePricing.isRescuePricing = true;
          rescuePricing.discountPercentage = batchItem.rescue_discount_percentage;

          // Calculate discounted price (rounded)
          finalUnitPrice = Math.round(productUnit.price * (100 - batchItem.rescue_discount_percentage) / 100);
          rescuePricing.discountAmount = productUnit.price - finalUnitPrice;
        } else if (
          !batchItem.rescue_pricing_enabled &&
          batchItem.manual_discount_percentage > 0
        ) {
          const manualDiscount = batchItem.manual_discount_percentage;
          finalUnitPrice = Math.round(
            (productUnit.price * (100 - manualDiscount)) / 100,
          );
        }

        const itemTotal = Math.round(finalUnitPrice * item.quantity);
        totalAmount += itemTotal;

        // Calculate tax based on product's tax_percentage (applied on discounted price)
        const itemTaxPercentage = productUnit.product_id.tax_percentage || 0;
        const itemTax = Math.round((itemTotal * itemTaxPercentage) / 100);
        taxAmount += itemTax;

        orderItems.push({
          product_unit_id: item.product_unit_id,
          product_batch_id: batch._id,
          batch_item_id: batchItem._id, // Store the specific item ID
          quantity: item.quantity,
          unit_price: finalUnitPrice,
          total_price: itemTotal,
          // Store for updating product total_stock
          product_id: productUnit.product_id._id,
          exchange_value: productUnit.exchange_value,
          // Rescue pricing info
          is_rescue_pricing: rescuePricing.isRescuePricing,
          original_unit_price: rescuePricing.originalPrice,
          rescue_discount_percentage: rescuePricing.discountPercentage,
          rescue_discount_amount: rescuePricing.discountAmount * item.quantity,
        });
      }

      // Validate and apply coupon if provided
      let couponDiscount = 0;
      let appliedCoupon = null;
      let appliedUserCoupon = null;

      if (couponCode && couponCode.trim()) {
        // Find coupon by code
        const coupon = await Coupon.findOne({
          code: couponCode.trim().toUpperCase(),
          status: "active",
        });

        if (!coupon) {
          throw new Error("Mã giảm giá không hợp lệ");
        }

        // Check expiry
        const now = new Date();
        if (now < coupon.start_date || now > coupon.end_date) {
          throw new Error("Mã giảm giá đã hết hạn");
        }

        // Check minimum order value
        if (totalAmount < coupon.min_order_value) {
          throw new Error(
            `Đơn hàng tối thiểu ${coupon.min_order_value.toLocaleString("vi-VN")}đ để sử dụng mã này`
          );
        }

        // If points-based coupon, check user ownership
        if (coupon.points_required && coupon.points_required > 0) {
          const userCoupon = await UserCoupon.findOne({
            user_id: userId,
            coupon_id: coupon._id,
            is_used: false,
          });

          if (!userCoupon) {
            throw new Error(
              "Bạn không sở hữu mã giảm giá này hoặc đã sử dụng"
            );
          }

          appliedUserCoupon = userCoupon;
        }

        // Calculate discount
        if (coupon.discount_type === "percent") {
          couponDiscount = Math.round(
            (totalAmount * coupon.discount_value) / 100
          );
          // Apply max discount cap
          if (
            coupon.max_discount_amount &&
            couponDiscount > coupon.max_discount_amount
          ) {
            couponDiscount = coupon.max_discount_amount;
          }
        } else {
          // fixed_amount
          couponDiscount = coupon.discount_value;
        }

        // Don't discount more than total
        couponDiscount = Math.min(couponDiscount, totalAmount);
        appliedCoupon = coupon;
      }

      // Calculate final amount (rounded)
      const finalAmount = Math.round(totalAmount + taxAmount - couponDiscount);

      // Create order
      const orderCode = this.generateOrderCode();
      const order = new Order({
        order_code: orderCode,
        user_id: userId,
        total_amount: Math.round(totalAmount),
        discount_amount: Math.round(couponDiscount),
        tax_amount: Math.round(taxAmount),
        final_amount: finalAmount,
        payment_method: paymentMethod,
        payment_status: "unpaid",
        order_status: "pending",
        order_type: "online",
        coupon_id: appliedCoupon ? appliedCoupon._id : null,
      });

      await order.save();

      // Mark UserCoupon as used if coupon was applied
      if (appliedUserCoupon) {
        appliedUserCoupon.is_used = true;
        appliedUserCoupon.used_at = new Date();
        await appliedUserCoupon.save();
      }

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
          // Rescue pricing fields
          is_rescue_pricing: item.is_rescue_pricing || false,
          original_unit_price: item.original_unit_price || item.unit_price,
          rescue_discount_percentage: item.rescue_discount_percentage || 0,
          rescue_discount_amount: item.rescue_discount_amount || 0,
        });
        await orderDetail.save();

        // Update batch item quantity and mark as sold when stock is fully consumed.
        const batchDoc = await ProductBatch.findById(item.product_batch_id);
        if (!batchDoc) {
          throw new Error(`Không tìm thấy lô hàng ${item.product_batch_id}`);
        }

        const batchItem = batchDoc.items.id(item.batch_item_id);
        if (!batchItem) {
          throw new Error(`Không tìm thấy sản phẩm trong lô ${item.product_batch_id}`);
        }

        batchItem.current_quantity = Math.max(
          0,
          (batchItem.current_quantity || 0) - item.quantity,
        );

        if (batchItem.current_quantity === 0) {
          batchItem.status = "sold";
          batchItem.rescue_pricing_active = false;
          batchItem.rescue_discount_percentage = 0;
        }

        await batchDoc.save();

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

  async getReorderPreview(userId, orderId) {
    const order = await Order.findOne({ _id: orderId, user_id: userId });

    if (!order) {
      throw new Error("Order not found");
    }

    const orderDetails = await OrderDetail.find({ order_id: orderId }).populate({
      path: "product_unit_id",
      populate: { path: "product_id unit_id" },
    });

    if (!orderDetails.length) {
      throw new Error("Order has no items to reorder");
    }

    const items = await Promise.all(
      orderDetails.map(async (detail) => {
        const productUnit = detail.product_unit_id;
        const product = productUnit?.product_id || null;
        const unit = productUnit?.unit_id || null;
        const previousQuantity = detail.quantity || 1;
        let availableQuantity = 0;

        let rescuePricing = {
          isAvailable: false,
          originalPrice: productUnit?.price || detail.unit_price || 0,
          discountPercentage: 0,
          discountedPrice: productUnit?.price || detail.unit_price || 0,
          savings: 0,
        };

        let availability = {
          isAvailable: true,
          reason: "",
        };

        if (!productUnit || productUnit.is_active === false || !product || !unit) {
          availability = {
            isAvailable: false,
            reason: "Sản phẩm không còn kinh doanh",
          };
        } else {
          const batch = await ProductBatch.findOne({
            "items.product_id": product._id,
            "items.unit_id": unit._id,
            "items.current_quantity": { $gt: 0 },
            "items.status": "onsale",
            is_deleted: false,
          }).sort({ created_at: 1 });

          if (!batch) {
            availability = {
              isAvailable: false,
              reason: "Không đủ tồn kho với số lượng đã mua trước đó",
            };
          } else {
            const batchItem = batch.items.find(
              (item) =>
                item.product_id.toString() === product._id.toString() &&
                item.unit_id.toString() === unit._id.toString() &&
                item.current_quantity > 0 &&
                item.status === "onsale",
            );

            if (!batchItem) {
              availability = {
                isAvailable: false,
                reason: "Không đủ tồn kho với số lượng đã mua trước đó",
              };
            } else {
              availableQuantity = batchItem.current_quantity || 0;

              let discountPercentage = 0;
              if (
                batchItem.rescue_pricing_enabled &&
                batchItem.rescue_pricing_active &&
                batchItem.rescue_discount_percentage > 0
              ) {
                discountPercentage = batchItem.rescue_discount_percentage;
              } else if (
                !batchItem.rescue_pricing_enabled &&
                batchItem.manual_discount_percentage > 0
              ) {
                discountPercentage = batchItem.manual_discount_percentage;
              }

              if (discountPercentage > 0) {
                const originalPrice = productUnit.price;
                const discountedPrice = Math.round(
                  (originalPrice * (100 - discountPercentage)) / 100,
                );

                rescuePricing = {
                  isAvailable: true,
                  originalPrice,
                  discountPercentage,
                  discountedPrice,
                  savings:
                    (originalPrice - discountedPrice) *
                    Math.min(previousQuantity, availableQuantity),
                };
              }

              if (availableQuantity < previousQuantity) {
                availability = {
                  isAvailable: true,
                  reason: `Hiện chỉ còn ${availableQuantity} sản phẩm khả dụng`,
                };
              }
            }
          }
        }

        const selectedQuantity = availableQuantity
          ? Math.min(previousQuantity, availableQuantity)
          : previousQuantity;

        return {
          id: detail._id,
          order_detail_id: detail._id,
          product_unit_id: productUnit?._id || null,
          quantity: selectedQuantity,
          previousQuantity,
          availableQuantity,
          productUnit,
          product,
          unit,
          rescuePricing,
          availability,
        };
      }),
    );

    return {
      order: {
        _id: order._id,
        order_code: order.order_code,
        created_at: order.created_at,
      },
      items,
      summary: {
        total: items.length,
        available: items.filter((item) => item.availability.isAvailable).length,
        unavailable: items.filter((item) => !item.availability.isAvailable).length,
      },
    };
  }

  // Reorder: add all valid items of an old order back to cart
  async reorderOrder(userId, orderId) {
    const order = await Order.findOne({ _id: orderId, user_id: userId });
    if (!order) {
      throw new Error("Order not found");
    }

    const orderDetails = await OrderDetail.find({ order_id: orderId }).populate({
      path: "product_unit_id",
      populate: { path: "product_id unit_id" },
    });

    if (!orderDetails.length) {
      throw new Error("Order has no items to reorder");
    }

    const addedItems = [];
    const skippedItems = [];

    for (const detail of orderDetails) {
      const productUnit = detail.product_unit_id;
      const quantity = detail.quantity || 1;

      if (!productUnit || productUnit.is_active === false) {
        skippedItems.push({
          order_detail_id: detail._id,
          product_unit_id: productUnit?._id || detail.product_unit_id,
          product_name: productUnit?.product_id?.name || "Sản phẩm không xác định",
          quantity,
          reason: "Sản phẩm không còn kinh doanh",
        });
        continue;
      }

      // Validate current inventory before adding to cart.
      const batch = await ProductBatch.findOne({
        "items.product_id": productUnit.product_id?._id,
        "items.unit_id": productUnit.unit_id?._id,
        "items.current_quantity": { $gte: quantity },
        "items.status": "onsale",
        is_deleted: false,
      }).sort({ created_at: 1 });

      if (!batch) {
        skippedItems.push({
          order_detail_id: detail._id,
          product_unit_id: productUnit._id,
          product_name: productUnit.product_id?.name || "Sản phẩm",
          quantity,
          reason: "Sản phẩm hiện không đủ tồn kho",
        });
        continue;
      }

      let cartItem = await CartItem.findOne({
        user_id: userId,
        product_unit_id: productUnit._id,
      });

      if (cartItem) {
        cartItem.quantity += quantity;
        await cartItem.save();
      } else {
        cartItem = await CartItem.create({
          user_id: userId,
          product_unit_id: productUnit._id,
          quantity,
        });
      }

      addedItems.push({
        cart_item_id: cartItem._id,
        product_unit_id: productUnit._id,
        product_name: productUnit.product_id?.name || "Sản phẩm",
        quantity,
      });
    }

    const message =
      skippedItems.length > 0
        ? `Đã thêm ${addedItems.length} sản phẩm vào giỏ hàng, ${skippedItems.length} sản phẩm không thể thêm.`
        : `Đã thêm ${addedItems.length} sản phẩm vào giỏ hàng.`;

    return {
      addedItems,
      skippedItems,
      summary: {
        total: orderDetails.length,
        added: addedItems.length,
        skipped: skippedItems.length,
      },
      message,
    };
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

            // Cộng điểm tích lũy cho khách hàng
            await this._awardLoyaltyPoints(order);
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

  // Get user orders (search/filter: order_code, date_from, date_to, order_status)
  async getUserOrders(userId, page = 1, limit = 10, filters = {}) {
    const skip = (page - 1) * limit;
    const query = { user_id: userId };

    // Mã đơn: tìm chuỗi con (regex, không phân biệt hoa thường)
    const orderCodeStr = typeof filters.order_code === "string" ? filters.order_code.trim() : "";
    if (orderCodeStr.length > 0) {
      const escaped = orderCodeStr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.order_code = { $regex: escaped, $options: "i" };
    }

    // Khoảng ngày
    if (filters.date_from) {
      const from = new Date(filters.date_from);
      from.setHours(0, 0, 0, 0);
      query.created_at = query.created_at || {};
      query.created_at.$gte = from;
    }
    if (filters.date_to) {
      const to = new Date(filters.date_to);
      to.setHours(23, 59, 59, 999);
      query.created_at = query.created_at || {};
      query.created_at.$lte = to;
    }

    // Trạng thái đơn: chỉ thêm vào query khi khác "all"
    const status = typeof filters.order_status === "string" ? filters.order_status.trim() : "";
    if (status && status !== "all") {
      const validStatuses = ["pending", "processing", "completed", "cancelled", "returned"];
      if (validStatuses.includes(status)) {
        query.order_status = status;
      }
    }

    const orders = await Order.find(query)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate("coupon_id");

    const total = await Order.countDocuments(query);

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
        created_at: { $lt: timeoutDate }, // Lọc ngày rành rành cũ hơn 15phút
      });

      if (expiredOrders.length === 0) return; // Không có rác thì quay đầu

      // 3. Có rác thì lôi ra xử từng ông một
      for (const order of expiredOrders) {
        // --- BƯỚC 3A: KIỂM TRA VỚI PAYOS TRƯỚC KHI CANCEL ---
        let paymentStatus = "PENDING"; // Mặc định chưa thanh toán

        try {
          // Gọi API PayOS để kiểm tra trạng thái thực tế
          if (order.payos_order_code) {
            const paymentInfo = await payos.paymentRequests.get(
              order.payos_order_code,
            );
            paymentStatus = paymentInfo.status; // PAID, PENDING, CANCELLED

            // Nếu đã thanh toán trên PayOS → CẬP NHẬT thay vì cancel
            if (paymentStatus === "PAID") {
              order.payment_status = "paid";
              order.order_status = "processing";
              await order.save();

              // Cộng điểm tích lũy cho khách hàng
              await this._awardLoyaltyPoints(order);
              continue; // Bỏ qua, không cancel
            }
          }
        } catch (payosError) {
          // Nếu lỗi khi gọi PayOS API (network, invalid order code...),
          // vẫn tiếp tục cancel để tránh đơn treo mãi
          console.error(
            `[Auto-Cron] ⚠️ Lỗi kiểm tra PayOS cho đơn ${order.order_code}:`,
            payosError.message,
          );
        }

        // --- BƯỚC 3B: Nếu PayOS trả về PENDING/CANCELLED hoặc lỗi → Cancel đơn ---
        order.order_status = "cancelled";
        // Ghi chú lý do hủy
        order.cancellation_reason = "System timeout: Unpaid PayOS order";
        await order.save();

        // --- BƯỚC 3C: Moi lại cái hóa đơn chi tiết để coi hồi nãy trừ mấy món đồ ---
        const details = await OrderDetail.find({
          order_id: order._id,
        }).populate("product_unit_id");

        for (const item of details) {
          if (!item.product_batch_id || !item.batch_item_id) continue;

          // Cộng ngược đồ đạc về kho (ProductBatch)
          await ProductBatch.updateOne(
            {
              _id: item.product_batch_id,
              "items._id": item.batch_item_id,
            },
            { $inc: { "items.$.current_quantity": item.quantity } }, // Lệnh $inc để cộng số dương
          );

          // Nhớ cộng lại tổng hiển thị kho ảo (Product.total_stock)
          const productUnit = item.product_unit_id;
          if (productUnit && productUnit.product_id) {
            const product = await Product.findById(productUnit.product_id);
            if (product) {
              const quantityInBaseUnit =
                item.quantity * (productUnit.exchange_value || 1);
              product.total_stock =
                (product.total_stock || 0) + quantityInBaseUnit;
              await product.save();
            }
          }
        }

        console.log(
          `[Auto-Cron] ❌ Đã HỦY và NHẢ KHO cho đơn mồ côi: ${order.order_code}`,
        );
      }
    } catch (error) {
      console.error("[Auto-Cron] Lỗi khi chạy quét rác tự động:", error);
    }
  }
  // ==================== LOYALTY POINTS ====================
  /**
   * Cộng điểm tích lũy cho khách hàng khi đơn được thanh toán thành công.
   * Công thức: 1.000đ = 1 điểm (floor)
   * Chỉ cộng khi payment_status = "paid".
   */
  async _awardLoyaltyPoints(order) {
    try {
      if (!order.user_id || order.payment_status !== "paid") return;

      const pointsEarned = Math.floor(order.final_amount / 1000);
      if (pointsEarned <= 0) return;

      await User.findByIdAndUpdate(order.user_id, {
        $inc: { loyalty_points: pointsEarned },
      });

      console.log(
        `[Loyalty] ⭐ Cộng ${pointsEarned} điểm cho user ${order.user_id} (đơn ${order.order_code}, ${order.final_amount.toLocaleString("vi-VN")}đ)`,
      );
    } catch (err) {
      // Không để lỗi điểm làm hỏng luồng thanh toán
      console.error("[Loyalty] Lỗi khi cộng điểm:", err.message);
    }
  }
}

module.exports = new OrderService();

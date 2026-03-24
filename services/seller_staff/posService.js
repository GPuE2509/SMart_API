const mongoose = require("mongoose");
const Order = require("../../models/Order");
const OrderDetail = require("../../models/OrderDetail");
const Product = require("../../models/Product");
const ProductUnit = require("../../models/ProductUnit");
const ProductBatch = require("../../models/ProductBatch");
const User = require("../../models/User");
const Coupon = require("../../models/Coupon");
const UserCoupon = require("../../models/UserCoupon");
const { sendPosReceiptEmail } = require("../emailService");
const { payos } = require("../../config/payment");

const removeVietnameseDiacritics = (str) => {
  if (str === null || str === undefined) return "";
  return String(str)
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]/g,
      "",
    )
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
};

class PosService {
  generateOrderCode() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `POS${timestamp}${random}`;
  }

  async createSalesTransaction(staffId) {
    return Order.create({
      order_code: this.generateOrderCode(),
      user_id: null,
      staff_id: staffId,
      total_amount: 0,
      discount_amount: 0,
      tax_amount: 0,
      final_amount: 0,
      payment_method: "cash",
      payment_status: "unpaid",
      order_status: "pending",
      order_type: "pos",
      is_on_hold: false,
    });
  }

  async getOpenTransactions(staffId) {
    const orders = await Order.find({
      staff_id: staffId,
      order_type: "pos",
      payment_status: "unpaid",
      order_status: { $nin: ["completed", "cancelled", "returned"] },
    })
      .populate("user_id", "full_name phone")
      .sort({ updatedAt: -1 })
      .lean();

    if (orders.length === 0) return [];

    const itemCountByOrder = await OrderDetail.aggregate([
      {
        $match: {
          order_id: { $in: orders.map((order) => order._id) },
        },
      },
      {
        $group: {
          _id: "$order_id",
          item_count: { $sum: 1 },
          total_quantity: { $sum: "$quantity" },
        },
      },
    ]);

    const itemCountMap = new Map(
      itemCountByOrder.map((item) => [String(item._id), item]),
    );

    return orders.map((order) => {
      const countInfo = itemCountMap.get(String(order._id));
      return {
        _id: order._id,
        order_code: order.order_code,
        user_id: order.user_id,
        final_amount: order.final_amount || 0,
        payment_status: order.payment_status,
        order_status: order.order_status,
        is_on_hold: Boolean(order.is_on_hold),
        item_count: countInfo?.item_count || 0,
        total_quantity: countInfo?.total_quantity || 0,
        updated_at: order.updatedAt || order.created_at,
      };
    });
  }

  async holdTransaction(transactionId, staffId) {
    const order = await this.findOwnedTransaction(transactionId, staffId);

    if (order.payment_status === "paid") {
      throw new Error("Không thể hold transaction đã thanh toán");
    }

    if (["completed", "cancelled", "returned"].includes(order.order_status)) {
      throw new Error("Transaction đã đóng, không thể hold");
    }

    order.is_on_hold = true;
    await order.save();

    return order;
  }

  async resumeTransaction(transactionId, staffId) {
    const order = await this.findOwnedTransaction(transactionId, staffId);

    if (order.payment_status === "paid") {
      throw new Error("Transaction đã thanh toán, không thể mở lại");
    }

    if (["completed", "cancelled", "returned"].includes(order.order_status)) {
      throw new Error("Transaction đã đóng, không thể mở lại");
    }

    order.is_on_hold = false;
    await order.save();

    return this.getTransactionById(order._id, staffId);
  }

  async getProducts(filters = {}) {
    const {
      search,
      category_id,
      min_price,
      max_price,
      stock_level,
      sort_by = "name",
      order = "asc",
      page = 1,
      limit = 20,
    } = filters;

    const unitQuery = { is_active: true };
    if (min_price || max_price) {
      unitQuery.price = {};
      if (min_price !== undefined && min_price !== null && min_price !== "") {
        unitQuery.price.$gte = Number(min_price);
      }
      if (max_price !== undefined && max_price !== null && max_price !== "") {
        unitQuery.price.$lte = Number(max_price);
      }
    }

    let units = await ProductUnit.find(unitQuery)
      .populate({
        path: "product_id",
        match: { is_active: true },
        populate: { path: "category_id", select: "name" },
      })
      .populate("unit_id", "name")
      .lean();

    units = units.filter((item) => item.product_id && item.unit_id);

    const mapped = await Promise.all(
      units.map(async (unit) => {
        const productId = unit.product_id._id;
        const unitId = unit.unit_id._id;

        const batches = await ProductBatch.find({
          is_deleted: false,
          items: {
            $elemMatch: {
              product_id: productId,
              unit_id: unitId,
              status: "onsale",
              current_quantity: { $gt: 0 },
            },
          },
        }).lean();

        let availableStock = 0;
        let maxDiscountPercentage = 0;

        for (const batch of batches) {
          for (const item of batch.items) {
            if (
              item.product_id.toString() === productId.toString() &&
              item.unit_id.toString() === unitId.toString() &&
              item.status === "onsale" &&
              item.current_quantity > 0
            ) {
              availableStock += item.current_quantity;

              let discountPercentage = 0;
              if (
                item.rescue_pricing_enabled &&
                item.rescue_pricing_active &&
                item.rescue_discount_percentage > 0
              ) {
                discountPercentage = item.rescue_discount_percentage;
              } else if (
                !item.rescue_pricing_enabled &&
                item.manual_discount_percentage > 0
              ) {
                discountPercentage = item.manual_discount_percentage;
              }

              if (discountPercentage > maxDiscountPercentage) {
                maxDiscountPercentage = discountPercentage;
              }
            }
          }
        }

        const originalPrice = Math.round(unit.price || 0);
        const discountedPrice = Math.round(
          originalPrice - (originalPrice * maxDiscountPercentage) / 100,
        );

        return {
          product_unit_id: unit._id,
          product_id: productId,
          product_name: unit.product_id.name,
          product_description: unit.product_id.description || "",
          product_image_url: unit.product_id.image_url || "",
          category_id: unit.product_id.category_id?._id || null,
          category_name: unit.product_id.category_id?.name || "",
          unit_id: unit.unit_id._id,
          unit_name: unit.unit_id.name,
          barcode: unit.barcode || "",
          price: discountedPrice,
          price_original: originalPrice,
          price_after_discount: discountedPrice,
          discount_percentage: maxDiscountPercentage,
          available_stock: availableStock,
        };
      }),
    );

    let filtered = mapped.filter((item) => item.available_stock > 0);

    if (category_id) {
      filtered = filtered.filter(
        (item) =>
          item.category_id && item.category_id.toString() === category_id,
      );
    }

    if (stock_level) {
      const stock = String(stock_level).toLowerCase();
      filtered = filtered.filter((item) => {
        if (stock === "low") return item.available_stock <= 5;
        if (stock === "medium")
          return item.available_stock >= 6 && item.available_stock <= 20;
        if (stock === "high") return item.available_stock > 20;
        return true;
      });
    }

    if (search) {
      const raw = search.trim().toLowerCase();
      const normalized = removeVietnameseDiacritics(search.trim());
      filtered = filtered.filter((item) => {
        const searchable = [
          item.product_name,
          item.product_description,
          item.barcode,
          item.category_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const normalizedSearchable = removeVietnameseDiacritics(searchable);

        return (
          searchable.includes(raw) || normalizedSearchable.includes(normalized)
        );
      });
    }

    const sortOrder = String(order).toLowerCase() === "desc" ? -1 : 1;
    filtered.sort((a, b) => {
      if (sort_by === "price") return (a.price - b.price) * sortOrder;
      if (sort_by === "stock")
        return (a.available_stock - b.available_stock) * sortOrder;
      return a.product_name.localeCompare(b.product_name) * sortOrder;
    });

    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    return {
      products: filtered.slice(skip, skip + limitNum),
      pagination: {
        total: filtered.length,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(filtered.length / limitNum),
      },
    };
  }

  async getSellableCategories() {
    const units = await ProductUnit.find({ is_active: true })
      .populate({
        path: "product_id",
        match: { is_active: true },
        populate: { path: "category_id", select: "name" },
      })
      .populate("unit_id", "name")
      .lean();

    const categoryMap = new Map();

    for (const unit of units) {
      const product = unit.product_id;
      if (!product || !product.category_id) continue;

      const productId = product._id;
      const unitId = unit.unit_id?._id;
      if (!unitId) continue;

      const batch = await ProductBatch.findOne({
        is_deleted: false,
        items: {
          $elemMatch: {
            product_id: productId,
            unit_id: unitId,
            status: "onsale",
            current_quantity: { $gt: 0 },
          },
        },
      }).lean();

      if (!batch) continue;

      const categoryId = product.category_id._id.toString();
      if (!categoryMap.has(categoryId)) {
        categoryMap.set(categoryId, {
          _id: product.category_id._id,
          name: product.category_id.name,
        });
      }
    }

    return Array.from(categoryMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }

  _normalizePhone(phone) {
    if (!phone) return "";
    return String(phone)
      .replace(/[^\d+]/g, "")
      .trim();
  }

  _buildCustomerPayload(user) {
    return {
      _id: user._id,
      full_name: user.full_name || "",
      email: user.email || "",
      phone: user.phone || "",
      loyalty_points: user.loyalty_points || 0,
    };
  }

  _extractLookupFromQr(rawValue) {
    if (rawValue === null || rawValue === undefined) {
      throw new Error("Thiếu dữ liệu QR");
    }

    if (typeof rawValue === "object") {
      const rawObj = rawValue;
      return {
        user_id: rawObj.user_id || rawObj.userId || rawObj.id || null,
        email: rawObj.email || null,
        phone: rawObj.phone || null,
      };
    }

    const raw = String(rawValue).trim();
    if (!raw) {
      throw new Error("Dữ liệu QR không hợp lệ");
    }

    if (mongoose.Types.ObjectId.isValid(raw)) {
      return { user_id: raw, email: null, phone: null };
    }

    if (raw.startsWith("{") && raw.endsWith("}")) {
      try {
        const parsed = JSON.parse(raw);
        return {
          user_id: parsed.user_id || parsed.userId || parsed.id || null,
          email: parsed.email || null,
          phone: parsed.phone || null,
        };
      } catch (error) {
        // Ignore parse error and fallback to regex parsing.
      }
    }

    if (raw.includes("://")) {
      try {
        const parsedUrl = new URL(raw);
        const userIdFromUrl =
          parsedUrl.searchParams.get("user_id") ||
          parsedUrl.searchParams.get("userId") ||
          parsedUrl.searchParams.get("id");
        const emailFromUrl = parsedUrl.searchParams.get("email");
        const phoneFromUrl = parsedUrl.searchParams.get("phone");

        if (userIdFromUrl || emailFromUrl || phoneFromUrl) {
          return {
            user_id: userIdFromUrl,
            email: emailFromUrl,
            phone: phoneFromUrl,
          };
        }
      } catch (error) {
        // Ignore URL parse error and fallback to regex parsing.
      }
    }

    const userIdToken = raw.match(/[a-fA-F0-9]{24}/)?.[0] || null;
    const emailToken =
      raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || null;
    const phoneToken = raw.match(/(?:\+?\d[\d\s.-]{7,}\d)/)?.[0] || null;

    return {
      user_id: userIdToken,
      email: emailToken,
      phone: this._normalizePhone(phoneToken),
    };
  }

  _extractBarcodeFromScan(rawValue) {
    if (rawValue === null || rawValue === undefined) {
      throw new Error("Thiếu dữ liệu mã vạch");
    }

    if (typeof rawValue === "object") {
      const rawObj = rawValue;
      const barcodeCandidate =
        rawObj.barcode || rawObj.code || rawObj.value || rawObj.scan_data;

      if (!barcodeCandidate) {
        throw new Error("Dữ liệu mã vạch không hợp lệ");
      }

      return String(barcodeCandidate).trim();
    }

    const raw = String(rawValue).trim();
    if (!raw) {
      throw new Error("Dữ liệu mã vạch không hợp lệ");
    }

    if (raw.startsWith("{") && raw.endsWith("}")) {
      try {
        const parsed = JSON.parse(raw);
        const barcodeCandidate =
          parsed.barcode || parsed.code || parsed.value || parsed.scan_data;
        if (barcodeCandidate) {
          return String(barcodeCandidate).trim();
        }
      } catch (error) {
        // Ignore parse error and fallback to raw text.
      }
    }

    if (raw.includes("://")) {
      try {
        const parsedUrl = new URL(raw);
        const barcodeFromUrl =
          parsedUrl.searchParams.get("barcode") ||
          parsedUrl.searchParams.get("code") ||
          parsedUrl.searchParams.get("value");
        if (barcodeFromUrl) {
          return String(barcodeFromUrl).trim();
        }
      } catch (error) {
        // Ignore URL parse error and fallback to raw text.
      }
    }

    return raw;
  }

  _isCouponInValidWindow(coupon, now = new Date()) {
    if (!coupon || coupon.status !== "active") return false;
    if (coupon.start_date && new Date(coupon.start_date) > now) return false;
    if (coupon.end_date && new Date(coupon.end_date) < now) return false;
    return true;
  }

  _calculateCouponDiscount(coupon, orderAmount) {
    if (!coupon) return 0;
    let discount = 0;

    if (coupon.discount_type === "percent") {
      discount = Math.round((orderAmount * (coupon.discount_value || 0)) / 100);
      if (coupon.max_discount_amount && coupon.max_discount_amount > 0) {
        discount = Math.min(discount, coupon.max_discount_amount);
      }
    } else {
      discount = Math.round(coupon.discount_value || 0);
    }

    return Math.max(0, Math.min(discount, orderAmount));
  }

  async _buildCustomerCoupons(user, orderAmount) {
    const now = new Date();

    const walletEntries = await UserCoupon.find({
      user_id: user._id,
      is_used: false,
    })
      .populate("coupon_id")
      .sort({ createdAt: -1 })
      .lean();

    const walletCoupons = walletEntries
      .filter((entry) => entry.coupon_id)
      .map((entry) => {
        const coupon = entry.coupon_id;
        const isActiveNow = this._isCouponInValidWindow(coupon, now);
        const meetsMinOrder =
          isActiveNow &&
          Number(orderAmount) >= Number(coupon.min_order_value || 0);

        return {
          user_coupon_id: entry._id,
          coupon,
          can_apply: Boolean(isActiveNow && meetsMinOrder),
          preview_discount: meetsMinOrder
            ? this._calculateCouponDiscount(coupon, Number(orderAmount) || 0)
            : 0,
          reason: isActiveNow
            ? meetsMinOrder
              ? ""
              : `Đơn hàng tối thiểu ${Number(coupon.min_order_value || 0).toLocaleString("vi-VN")}đ`
            : "Coupon không còn hiệu lực",
        };
      });

    const redeemableCouponDocs = await Coupon.find({
      status: "active",
      points_required: { $gt: 0 },
      $and: [
        { $or: [{ start_date: null }, { start_date: { $lte: now } }] },
        { $or: [{ end_date: null }, { end_date: { $gte: now } }] },
      ],
    })
      .sort({ points_required: 1, createdAt: -1 })
      .lean();

    const redeemableCoupons = await Promise.all(
      redeemableCouponDocs.map(async (coupon) => {
        let quantityRemaining = null;
        if (
          coupon.quantity_limit !== undefined &&
          coupon.quantity_limit !== null
        ) {
          const issuedCount = await UserCoupon.countDocuments({
            coupon_id: coupon._id,
          });
          quantityRemaining = Math.max(
            0,
            Number(coupon.quantity_limit) - issuedCount,
          );
        }

        const canRedeemByPoints =
          Number(user.loyalty_points || 0) >=
          Number(coupon.points_required || 0);
        const meetsMinOrder =
          Number(orderAmount || 0) >= Number(coupon.min_order_value || 0);
        const hasQuantity = quantityRemaining === null || quantityRemaining > 0;

        return {
          coupon,
          can_redeem: Boolean(canRedeemByPoints && hasQuantity),
          can_apply_after_redeem: Boolean(
            canRedeemByPoints && hasQuantity && meetsMinOrder,
          ),
          quantity_remaining: quantityRemaining,
          preview_discount: meetsMinOrder
            ? this._calculateCouponDiscount(coupon, Number(orderAmount) || 0)
            : 0,
        };
      }),
    );

    return {
      wallet_coupons: walletCoupons,
      redeemable_coupons: redeemableCoupons,
    };
  }

  async resolveCustomerFromQr(qrData) {
    const lookup = this._extractLookupFromQr(qrData);

    const query = {
      role: "customer",
      status: "active",
      isVerified: true,
    };

    if (lookup.user_id && mongoose.Types.ObjectId.isValid(lookup.user_id)) {
      query._id = lookup.user_id;
    } else if (lookup.email) {
      query.email = new RegExp(
        `^${lookup.email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        "i",
      );
    } else if (lookup.phone) {
      query.phone = new RegExp(
        this._normalizePhone(lookup.phone).replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&",
        ),
        "i",
      );
    } else {
      throw new Error("Không thể xác định khách hàng từ QR");
    }

    const user = await User.findOne(query).select(
      "full_name email phone loyalty_points role status isVerified",
    );

    if (!user) {
      throw new Error("Không tìm thấy khách hàng từ mã QR");
    }

    return this._buildCustomerPayload(user);
  }

  async searchCustomers(keyword, limit = 20) {
    const rawKeyword = String(keyword || "").trim();
    if (!rawKeyword) {
      throw new Error("Thiếu từ khóa tìm kiếm");
    }

    const escaped = rawKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const normalizedPhone = this._normalizePhone(rawKeyword);

    const customers = await User.find({
      role: "customer",
      status: "active",
      isVerified: true,
      $or: [
        { full_name: new RegExp(escaped, "i") },
        { email: new RegExp(escaped, "i") },
        { phone: new RegExp(normalizedPhone || escaped, "i") },
      ],
    })
      .select("full_name email phone loyalty_points")
      .sort({ updated_at: -1 })
      .limit(Number(limit) || 20)
      .lean();

    return customers.map((user) => this._buildCustomerPayload(user));
  }

  async assignCustomerToTransaction(transactionId, staffId, userId) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error("Mã khách hàng không hợp lệ");
    }

    const order = await this.findOwnedTransaction(transactionId, staffId);
    if (["cancelled", "completed", "returned"].includes(order.order_status)) {
      throw new Error("Transaction đã đóng, không thể gán khách hàng");
    }

    const customer = await User.findOne({
      _id: userId,
      role: "customer",
      status: "active",
      isVerified: true,
    });

    if (!customer) {
      throw new Error("Không tìm thấy khách hàng hợp lệ");
    }

    order.user_id = customer._id;
    await order.save();
    await this.recalculateTransactionTotals(order._id, staffId);

    return this.getTransactionById(order._id, staffId);
  }

  async getTransactionCustomerCoupons(transactionId, staffId, options = {}) {
    const order = await this.findOwnedTransaction(transactionId, staffId);

    const customerId = options.user_id || order.user_id;
    if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
      throw new Error("Transaction chưa có khách hàng");
    }

    const customer = await User.findOne({
      _id: customerId,
      role: "customer",
      status: "active",
      isVerified: true,
    }).select("full_name email phone loyalty_points");

    if (!customer) {
      throw new Error("Không tìm thấy khách hàng hợp lệ");
    }

    const orderAmount = Number(options.order_amount || order.total_amount || 0);
    const coupons = await this._buildCustomerCoupons(customer, orderAmount);

    return {
      customer: this._buildCustomerPayload(customer),
      order_amount: orderAmount,
      coupons,
    };
  }

  async redeemCouponForCustomer(transactionId, staffId, couponId) {
    if (!mongoose.Types.ObjectId.isValid(couponId)) {
      throw new Error("Mã coupon không hợp lệ");
    }

    const order = await this.findOwnedTransaction(transactionId, staffId);
    if (["cancelled", "completed", "returned"].includes(order.order_status)) {
      throw new Error("Transaction đã đóng, không thể đổi coupon");
    }

    if (!order.user_id) {
      throw new Error("Vui lòng gán khách hàng trước khi đổi coupon");
    }

    const customer = await User.findOne({
      _id: order.user_id,
      role: "customer",
      status: "active",
      isVerified: true,
    });

    if (!customer) {
      throw new Error("Không tìm thấy khách hàng hợp lệ");
    }

    const coupon = await Coupon.findById(couponId);
    if (!coupon || coupon.status !== "active") {
      throw new Error("Coupon hiện không hoạt động");
    }

    if (!this._isCouponInValidWindow(coupon)) {
      throw new Error("Coupon đã hết hạn hoặc chưa đến thời gian áp dụng");
    }

    const requiredPoints = Number(coupon.points_required || 0);
    if (requiredPoints <= 0) {
      throw new Error("Coupon này không thể đổi bằng điểm");
    }

    if (Number(customer.loyalty_points || 0) < requiredPoints) {
      throw new Error("Điểm tích lũy không đủ để đổi coupon này");
    }

    if (coupon.quantity_limit !== undefined && coupon.quantity_limit !== null) {
      const issuedCount = await UserCoupon.countDocuments({
        coupon_id: coupon._id,
      });
      if (issuedCount >= Number(coupon.quantity_limit)) {
        throw new Error("Coupon đã hết số lượng");
      }
    }

    customer.loyalty_points =
      Number(customer.loyalty_points || 0) - requiredPoints;
    await customer.save();

    const userCoupon = await UserCoupon.create({
      user_id: customer._id,
      coupon_id: coupon._id,
    });

    const refreshed = await this.getTransactionCustomerCoupons(
      order._id,
      staffId,
    );

    return {
      user_coupon_id: userCoupon._id,
      customer: {
        _id: customer._id,
        loyalty_points: customer.loyalty_points,
      },
      coupon,
      coupons: refreshed.coupons,
    };
  }

  async applyCouponToTransaction(transactionId, staffId, couponCode) {
    const order = await this.findOwnedTransaction(transactionId, staffId);
    if (["cancelled", "completed", "returned"].includes(order.order_status)) {
      throw new Error("Transaction đã đóng, không thể áp mã giảm giá");
    }

    if (!order.user_id) {
      throw new Error("Vui lòng gán khách hàng trước khi áp mã giảm giá");
    }

    const rawCode = String(couponCode || "")
      .trim()
      .toUpperCase();
    if (!rawCode) {
      throw new Error("Mã giảm giá không hợp lệ");
    }

    await this.recalculateTransactionTotals(order._id, staffId);
    const latestOrder = await Order.findById(order._id);
    if (!latestOrder) {
      throw new Error("Không tìm thấy transaction POS");
    }

    const coupon = await Coupon.findOne({
      code: rawCode,
      status: "active",
    });

    if (!coupon || !this._isCouponInValidWindow(coupon)) {
      throw new Error("Mã giảm giá không hợp lệ hoặc đã hết hạn");
    }

    if (
      Number(latestOrder.total_amount || 0) <
      Number(coupon.min_order_value || 0)
    ) {
      throw new Error(
        `Đơn hàng tối thiểu ${Number(coupon.min_order_value || 0).toLocaleString("vi-VN")}đ để sử dụng mã này`,
      );
    }

    if (Number(coupon.points_required || 0) > 0) {
      const userCoupon = await UserCoupon.findOne({
        user_id: latestOrder.user_id,
        coupon_id: coupon._id,
        is_used: false,
      });

      if (!userCoupon) {
        throw new Error("Khách hàng chưa sở hữu mã giảm giá này");
      }
    }

    latestOrder.coupon_id = coupon._id;
    await latestOrder.save();
    await this.recalculateTransactionTotals(latestOrder._id, staffId);

    return this.getTransactionById(latestOrder._id, staffId);
  }

  async removeCouponFromTransaction(transactionId, staffId) {
    const order = await this.findOwnedTransaction(transactionId, staffId);
    if (["cancelled", "completed", "returned"].includes(order.order_status)) {
      throw new Error("Transaction đã đóng, không thể xóa mã giảm giá");
    }

    order.coupon_id = null;
    await order.save();
    await this.recalculateTransactionTotals(order._id, staffId);

    return this.getTransactionById(order._id, staffId);
  }

  async findOwnedTransaction(transactionId, staffId) {
    if (!mongoose.Types.ObjectId.isValid(transactionId)) {
      throw new Error("Mã transaction không hợp lệ");
    }

    const order = await Order.findOne({
      _id: transactionId,
      staff_id: staffId,
      order_type: "pos",
    });

    if (!order) {
      throw new Error("Không tìm thấy transaction POS");
    }

    return order;
  }

  async getTransactionById(transactionId, staffId) {
    const order = await this.findOwnedTransaction(transactionId, staffId);

    const hydratedOrder = await Order.findById(order._id)
      .populate("user_id", "full_name email phone loyalty_points")
      .populate(
        "coupon_id",
        "code discount_type discount_value min_order_value max_discount_amount points_required",
      );

    const orderDetails = await OrderDetail.find({
      order_id: order._id,
    }).populate({
      path: "product_unit_id",
      populate: [
        { path: "product_id", select: "name image_url" },
        { path: "unit_id", select: "name" },
      ],
    });

    return {
      order: hydratedOrder || order,
      items: orderDetails,
    };
  }

  async addProductToTransaction(transactionId, staffId, payload) {
    const { product_unit_id, quantity = 1 } = payload;

    if (!mongoose.Types.ObjectId.isValid(product_unit_id)) {
      throw new Error("Mã sản phẩm không hợp lệ");
    }

    const qty = Number(quantity);
    if (!qty || qty < 1) {
      throw new Error("Số lượng phải lớn hơn hoặc bằng 1");
    }

    const order = await this.findOwnedTransaction(transactionId, staffId);
    if (["cancelled", "completed", "returned"].includes(order.order_status)) {
      throw new Error("Transaction đã đóng, không thể thêm sản phẩm");
    }

    const existingDetail = await OrderDetail.findOne({
      order_id: order._id,
      product_unit_id,
    });

    if (existingDetail) {
      const nextQuantity = Number(existingDetail.quantity || 0) + qty;
      return this.updateItemQuantity(
        transactionId,
        existingDetail._id,
        staffId,
        nextQuantity,
      );
    }

    const productUnit = await ProductUnit.findById(product_unit_id)
      .populate("product_id")
      .populate("unit_id");

    if (
      !productUnit ||
      !productUnit.is_active ||
      !productUnit.product_id ||
      !productUnit.unit_id
    ) {
      throw new Error("Sản phẩm không tồn tại hoặc đã ngừng kinh doanh");
    }

    const batch = await ProductBatch.findOne({
      "items.product_id": productUnit.product_id._id,
      "items.unit_id": productUnit.unit_id._id,
      "items.current_quantity": { $gte: qty },
      "items.status": "onsale",
      is_deleted: false,
    }).sort({ created_at: 1 });

    if (!batch) {
      throw new Error("Sản phẩm không đủ tồn kho để thêm vào transaction");
    }

    const batchItem = batch.items.find(
      (item) =>
        item.product_id.toString() === productUnit.product_id._id.toString() &&
        item.unit_id.toString() === productUnit.unit_id._id.toString() &&
        item.current_quantity >= qty &&
        item.status === "onsale",
    );

    if (!batchItem) {
      throw new Error("Không tìm thấy lô hàng phù hợp để xuất bán");
    }

    const unitPrice = Math.round(productUnit.price || 0);
    const totalPrice = Math.round(unitPrice * qty);

    const detail = await OrderDetail.create({
      order_id: order._id,
      product_unit_id,
      product_batch_id: batch._id,
      batch_item_id: batchItem._id,
      quantity: qty,
      unit_price: unitPrice,
      total_price: totalPrice,
    });

    batchItem.current_quantity = Math.max(
      0,
      (batchItem.current_quantity || 0) - qty,
    );
    if (batchItem.current_quantity === 0) {
      batchItem.status = "sold";
      batchItem.rescue_pricing_active = false;
      batchItem.rescue_discount_percentage = 0;
    }
    await batch.save();

    const product = await Product.findById(productUnit.product_id._id);
    if (product) {
      const quantityInBase = qty * (productUnit.exchange_value || 1);
      product.total_stock = Math.max(
        0,
        (product.total_stock || 0) - quantityInBase,
      );
      await product.save();
    }

    await this.recalculateTransactionTotals(order._id, staffId);
    return this.getTransactionById(order._id, staffId);
  }

  async addProductToTransactionByBarcode(transactionId, staffId, payload = {}) {
    const barcode = this._extractBarcodeFromScan(
      payload.barcode || payload.scan_data || payload,
    );
    const quantity = Number(payload.quantity || 1);

    if (!quantity || quantity < 1) {
      throw new Error("Số lượng phải lớn hơn hoặc bằng 1");
    }

    const productUnit = await ProductUnit.findOne({
      barcode,
      is_active: true,
    }).select("_id");

    if (!productUnit) {
      throw new Error("Không tìm thấy sản phẩm với mã vạch đã quét");
    }

    return this.addProductToTransaction(transactionId, staffId, {
      product_unit_id: productUnit._id,
      quantity,
    });
  }

  async updateItemQuantity(transactionId, itemId, staffId, newQuantity) {
    const order = await this.findOwnedTransaction(transactionId, staffId);

    if (["cancelled", "completed", "returned"].includes(order.order_status)) {
      throw new Error("Transaction đã đóng, không thể cập nhật sản phẩm");
    }

    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      throw new Error("Mã item không hợp lệ");
    }

    const qty = Number(newQuantity);
    if (qty < 0 || !Number.isInteger(qty)) {
      throw new Error("Số lượng không hợp lệ");
    }

    // Nếu quantity = 0, tự động xóa item
    if (qty === 0) {
      return this.removeItemFromTransaction(transactionId, itemId, staffId);
    }

    const detail = await OrderDetail.findOne({
      _id: itemId,
      order_id: order._id,
    }).populate("product_unit_id");

    if (!detail) {
      throw new Error("Không tìm thấy item trong transaction");
    }

    const oldQuantity = detail.quantity;
    const quantityDiff = qty - oldQuantity;

    if (quantityDiff === 0) {
      // Không có thay đổi
      return this.getTransactionById(order._id, staffId);
    }

    const productUnit = detail.product_unit_id;
    if (
      !productUnit ||
      !productUnit.is_active ||
      !productUnit.product_id ||
      !productUnit.unit_id
    ) {
      throw new Error("Sản phẩm không tồn tại hoặc đã ngừng kinh doanh");
    }

    const candidateBatches = await ProductBatch.find({
      "items.product_id": productUnit.product_id._id,
      "items.unit_id": productUnit.unit_id._id,
      "items.status": "onsale",
      is_deleted: false,
    }).sort({ created_at: 1 });

    let selectedBatchId = null;
    let selectedBatchItemId = null;

    for (const batch of candidateBatches) {
      const batchItem = batch.items.find(
        (item) =>
          item.product_id.toString() ===
            productUnit.product_id._id.toString() &&
          item.unit_id.toString() === productUnit.unit_id._id.toString() &&
          item.status === "onsale",
      );

      if (!batchItem) continue;

      const isCurrentBatchItem =
        detail.product_batch_id &&
        detail.batch_item_id &&
        String(batch._id) === String(detail.product_batch_id) &&
        String(batchItem._id) === String(detail.batch_item_id);

      const virtualAvailable =
        Number(batchItem.current_quantity || 0) +
        (isCurrentBatchItem ? Number(oldQuantity || 0) : 0);

      if (virtualAvailable >= qty) {
        selectedBatchId = batch._id;
        selectedBatchItemId = batchItem._id;
        break;
      }
    }

    if (!selectedBatchId || !selectedBatchItemId) {
      throw new Error(
        `Không đủ tồn kho để cập nhật số lượng lên ${qty}. Tồn kho không đủ.`,
      );
    }

    // Hoàn lại toàn bộ số lượng cũ về batch cũ trước khi phân bổ lại.
    if (detail.product_batch_id && detail.batch_item_id) {
      const currentBatch = await ProductBatch.findById(detail.product_batch_id);
      if (currentBatch) {
        const currentBatchItem = currentBatch.items.id(detail.batch_item_id);
        if (currentBatchItem) {
          currentBatchItem.current_quantity =
            Number(currentBatchItem.current_quantity || 0) +
            Number(oldQuantity || 0);
          if (currentBatchItem.status === "sold") {
            currentBatchItem.status = "onsale";
          }
          await currentBatch.save();
        }
      }
    }

    const selectedBatch = await ProductBatch.findById(selectedBatchId);
    if (!selectedBatch) {
      throw new Error("Không tìm thấy lô hàng phù hợp để cập nhật sản phẩm");
    }

    const selectedBatchItem = selectedBatch.items.id(selectedBatchItemId);
    if (!selectedBatchItem) {
      throw new Error("Không tìm thấy mặt hàng trong lô để cập nhật sản phẩm");
    }

    selectedBatchItem.current_quantity = Math.max(
      0,
      Number(selectedBatchItem.current_quantity || 0) - qty,
    );

    if (selectedBatchItem.current_quantity === 0) {
      selectedBatchItem.status = "sold";
      selectedBatchItem.rescue_pricing_active = false;
      selectedBatchItem.rescue_discount_percentage = 0;
    } else if (selectedBatchItem.status === "sold") {
      selectedBatchItem.status = "onsale";
    }

    await selectedBatch.save();

    // Cập nhật tổng tồn kho sản phẩm
    const product = await Product.findById(productUnit.product_id._id);
    if (product) {
      const quantityInBaseDiff =
        quantityDiff * (productUnit.exchange_value || 1);
      product.total_stock = Math.max(
        0,
        (product.total_stock || 0) - quantityInBaseDiff,
      );
      await product.save();
    }

    // Cập nhật OrderDetail
    detail.product_batch_id = selectedBatch._id;
    detail.batch_item_id = selectedBatchItem._id;
    detail.quantity = qty;
    detail.total_price = Math.round(detail.unit_price * qty);
    await detail.save();

    await this.recalculateTransactionTotals(order._id, staffId);
    return this.getTransactionById(order._id, staffId);
  }

  async removeItemFromTransaction(transactionId, itemId, staffId) {
    const order = await this.findOwnedTransaction(transactionId, staffId);

    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      throw new Error("Mã item không hợp lệ");
    }

    const detail = await OrderDetail.findOne({
      _id: itemId,
      order_id: order._id,
    }).populate("product_unit_id");

    if (!detail) {
      throw new Error("Không tìm thấy item trong transaction");
    }

    if (detail.product_batch_id && detail.batch_item_id) {
      const batch = await ProductBatch.findById(detail.product_batch_id);
      if (batch) {
        const batchItem = batch.items.id(detail.batch_item_id);
        if (batchItem) {
          batchItem.current_quantity =
            (batchItem.current_quantity || 0) + detail.quantity;
          if (batchItem.status === "sold") {
            batchItem.status = "onsale";
          }
          await batch.save();
        }
      }
    }

    const productUnit = detail.product_unit_id;
    if (productUnit && productUnit.product_id) {
      const product = await Product.findById(productUnit.product_id);
      if (product) {
        const quantityInBase =
          detail.quantity * (productUnit.exchange_value || 1);
        product.total_stock = (product.total_stock || 0) + quantityInBase;
        await product.save();
      }
    }

    await detail.deleteOne();
    await this.recalculateTransactionTotals(order._id, staffId);
    return this.getTransactionById(order._id, staffId);
  }

  async deleteTransaction(transactionId, staffId) {
    const order = await this.findOwnedTransaction(transactionId, staffId);

    if (order.payment_status === "paid") {
      throw new Error("Không thể xóa transaction đã thanh toán");
    }

    if (order.order_status === "cancelled") {
      return order;
    }

    const details = await OrderDetail.find({ order_id: order._id }).populate(
      "product_unit_id",
    );

    for (const detail of details) {
      if (detail.product_batch_id && detail.batch_item_id) {
        const batch = await ProductBatch.findById(detail.product_batch_id);
        if (batch) {
          const batchItem = batch.items.id(detail.batch_item_id);
          if (batchItem) {
            batchItem.current_quantity =
              (batchItem.current_quantity || 0) + detail.quantity;
            if (batchItem.status === "sold") {
              batchItem.status = "onsale";
            }
            await batch.save();
          }
        }
      }

      const productUnit = detail.product_unit_id;
      if (productUnit && productUnit.product_id) {
        const product = await Product.findById(productUnit.product_id);
        if (product) {
          const quantityInBase =
            detail.quantity * (productUnit.exchange_value || 1);
          product.total_stock = (product.total_stock || 0) + quantityInBase;
          await product.save();
        }
      }
    }

    await OrderDetail.deleteMany({ order_id: order._id });

    order.total_amount = 0;
    order.tax_amount = 0;
    order.discount_amount = 0;
    order.final_amount = 0;
    order.coupon_id = null;
    order.order_status = "cancelled";
    order.payment_status = "unpaid";
    await order.save();

    return order;
  }

  async recalculateTransactionTotals(transactionId, staffId) {
    const order = await this.findOwnedTransaction(transactionId, staffId);

    const details = await OrderDetail.find({ order_id: order._id }).populate({
      path: "product_unit_id",
      populate: { path: "product_id", select: "tax_percentage" },
    });

    const totalAmount = details.reduce(
      (sum, item) => sum + (item.total_price || 0),
      0,
    );
    let taxAmount = 0;

    for (const detail of details) {
      const taxPercentage =
        detail.product_unit_id?.product_id?.tax_percentage || 0;
      taxAmount += Math.round(
        ((detail.total_price || 0) * taxPercentage) / 100,
      );
    }

    order.total_amount = Math.round(totalAmount);
    order.tax_amount = Math.round(taxAmount);

    let discountAmount = 0;
    if (order.coupon_id) {
      const coupon = await Coupon.findById(order.coupon_id);
      const isCouponUsable =
        coupon &&
        this._isCouponInValidWindow(coupon) &&
        order.total_amount >= Number(coupon.min_order_value || 0);

      if (isCouponUsable) {
        discountAmount = this._calculateCouponDiscount(
          coupon,
          order.total_amount,
        );
      } else {
        order.coupon_id = null;
      }
    }

    order.discount_amount = Math.round(discountAmount);
    order.final_amount = Math.round(order.total_amount + order.tax_amount);
    order.final_amount = Math.max(
      0,
      Math.round(order.final_amount - order.discount_amount),
    );
    await order.save();

    return order;
  }

  async _consumePointsCouponIfNeeded(order) {
    if (!order?.user_id || !order?.coupon_id) return;

    const coupon = await Coupon.findById(order.coupon_id).lean();
    if (!coupon || Number(coupon.points_required || 0) <= 0) return;

    const userCoupon = await UserCoupon.findOne({
      user_id: order.user_id,
      coupon_id: order.coupon_id,
      is_used: false,
    }).sort({ createdAt: 1 });

    if (!userCoupon) {
      console.warn(
        `[POS-Coupon] Không tìm thấy userCoupon chưa dùng cho user ${order.user_id} với coupon ${order.coupon_id}`,
      );
      return;
    }

    userCoupon.is_used = true;
    userCoupon.used_at = new Date();
    await userCoupon.save();
  }

  async _awardLoyaltyPoints(order) {
    try {
      if (!order?.user_id || order.payment_status !== "paid") return;

      const pointsEarned = Math.floor(Number(order.final_amount || 0) / 1000);
      if (pointsEarned <= 0) return;

      await User.findByIdAndUpdate(order.user_id, {
        $inc: { loyalty_points: pointsEarned },
      });

      console.log(
        `[POS-Loyalty] Cong ${pointsEarned} diem cho user ${order.user_id} (don ${order.order_code})`,
      );
    } catch (error) {
      console.error("[POS-Loyalty] Loi khi cong diem:", error.message);
    }
  }

  async _finalizeBenefitsAfterPayment(order) {
    await this._consumePointsCouponIfNeeded(order);
    await this._awardLoyaltyPoints(order);
  }

  async createPayOSPayment(transactionId, staffId) {
    const order = await this.findOwnedTransaction(transactionId, staffId);
    if (order.payment_status === "paid") {
      throw new Error("Đơn hàng đã thanh toán");
    }

    const itemCount = await OrderDetail.countDocuments({ order_id: order._id });
    if (itemCount === 0) {
      throw new Error("Transaction chưa có sản phẩm để thanh toán");
    }

    await this.recalculateTransactionTotals(order._id, staffId);
    const latestOrder = await Order.findById(order._id);

    if (!latestOrder || latestOrder.final_amount <= 0) {
      throw new Error("Không thể tạo thanh toán cho đơn có tổng tiền bằng 0");
    }

    const orderDetails = await OrderDetail.find({
      order_id: latestOrder._id,
    }).populate({
      path: "product_unit_id",
      populate: { path: "product_id", select: "name" },
    });

    const items = orderDetails.map((detail) => ({
      name: detail.product_unit_id?.product_id?.name || "Sản phẩm",
      quantity: detail.quantity,
      price: Math.round(detail.unit_price || 0),
    }));

    const webClientUrl = process.env.WEB_CLIENT_URL || "http://localhost:5173";
    const query = `payos=1&transactionId=${latestOrder._id}`;
    const returnUrl = `${webClientUrl}/seller/pos?${query}&flow=return`;
    const cancelUrl = `${webClientUrl}/seller/pos?${query}&flow=cancel`;

    const paymentData = {
      orderCode: Number(Date.now()),
      amount: Math.round(latestOrder.final_amount),
      description: `POS ${latestOrder.order_code.slice(-8)}`,
      items,
      returnUrl,
      cancelUrl,
    };

    const paymentLink = await payos.paymentRequests.create(paymentData);

    latestOrder.payment_method = "payos";
    latestOrder.order_status = "processing";
    latestOrder.payos_order_code = paymentData.orderCode;
    await latestOrder.save();

    return {
      checkoutUrl: paymentLink.checkoutUrl,
    };
  }

  async completeCashPayment(transactionId, staffId) {
    const order = await this.findOwnedTransaction(transactionId, staffId);

    if (order.payment_status === "paid") {
      throw new Error("Đơn hàng đã được thanh toán trước đó");
    }

    const itemCount = await OrderDetail.countDocuments({ order_id: order._id });
    if (itemCount === 0) {
      throw new Error("Transaction chưa có sản phẩm để hoàn thành");
    }

    await this.recalculateTransactionTotals(order._id, staffId);
    const latestOrder = await Order.findById(order._id);

    if (!latestOrder || latestOrder.final_amount <= 0) {
      throw new Error("Không thể hoàn thành đơn có tổng tiền bằng 0");
    }

    latestOrder.payment_method = "cash";
    latestOrder.payment_status = "paid";
    latestOrder.order_status = "completed";
    await latestOrder.save();

    await this._finalizeBenefitsAfterPayment(latestOrder);

    return latestOrder;
  }

  async completeCodPayment(transactionId, staffId, payload = {}) {
    const order = await this.findOwnedTransaction(transactionId, staffId);

    if (order.payment_status === "paid") {
      throw new Error("Đơn hàng đã được thanh toán trước đó");
    }

    const itemCount = await OrderDetail.countDocuments({ order_id: order._id });
    if (itemCount === 0) {
      throw new Error("Transaction chưa có sản phẩm để hoàn thành");
    }

    await this.recalculateTransactionTotals(order._id, staffId);
    const latestOrder = await Order.findById(order._id);

    if (!latestOrder || latestOrder.final_amount <= 0) {
      throw new Error("Không thể hoàn thành đơn có tổng tiền bằng 0");
    }

    const cashReceived = Number(payload.cash_received);
    if (!Number.isFinite(cashReceived) || cashReceived <= 0) {
      throw new Error("Tiền khách đưa phải lớn hơn 0");
    }

    const roundedCashReceived = Math.round(cashReceived);
    if (roundedCashReceived < latestOrder.final_amount) {
      throw new Error("Tiền khách đưa không đủ để thanh toán");
    }

    const changeAmount = Math.round(
      roundedCashReceived - latestOrder.final_amount,
    );

    latestOrder.payment_method = "cod";
    latestOrder.payment_status = "paid";
    latestOrder.order_status = "completed";
    await latestOrder.save();

    await this._finalizeBenefitsAfterPayment(latestOrder);

    return {
      order: latestOrder,
      cash_received: roundedCashReceived,
      change_amount: changeAmount,
    };
  }

  async checkAndUpdatePaymentStatus(transactionId, staffId) {
    const order = await this.findOwnedTransaction(transactionId, staffId);

    if (order.payment_method !== "payos") {
      return {
        order_id: order._id,
        order_code: order.order_code,
        payment_method: order.payment_method,
        payment_status: order.payment_status,
        order_status: order.order_status,
        final_amount: order.final_amount,
        provider_status: null,
      };
    }

    let providerStatus = null;

    if (order.payos_order_code) {
      try {
        const paymentInfo = await payos.paymentRequests.get(
          order.payos_order_code,
        );
        providerStatus = paymentInfo?.status || null;

        if (providerStatus === "PAID" && order.payment_status !== "paid") {
          order.payment_status = "paid";
          order.order_status = "processing";
          await order.save();
          await this._finalizeBenefitsAfterPayment(order);
        }
      } catch (error) {
        console.error("POS PayOS status check error:", error.message);
      }
    }

    return {
      order_id: order._id,
      order_code: order.order_code,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      order_status: order.order_status,
      final_amount: order.final_amount,
      provider_status: providerStatus,
    };
  }

  async issueReceipt(transactionId, staffId, payload = {}) {
    const order = await this.findOwnedTransaction(transactionId, staffId);
    const orderDetails = await OrderDetail.find({
      order_id: order._id,
    }).populate({
      path: "product_unit_id",
      populate: [
        { path: "product_id", select: "name" },
        { path: "unit_id", select: "name" },
      ],
    });

    if (orderDetails.length === 0) {
      throw new Error("Transaction chưa có sản phẩm để xuất biên lai");
    }

    const staff = await User.findById(order.staff_id).select(
      "username full_name",
    );

    const receiptData = {
      order_id: order._id,
      order_code: order.order_code,
      issued_at: new Date(),
      payment_method: order.payment_method || "cash",
      payment_status: order.payment_status || "unpaid",
      subtotal: Math.round(order.total_amount || 0),
      tax_amount: Math.round(order.tax_amount || 0),
      discount_amount: Math.round(order.discount_amount || 0),
      final_amount: Math.round(order.final_amount || 0),
      staff_name: staff?.full_name || staff?.username || "Staff",
      items: orderDetails.map((detail) => ({
        product_name: detail.product_unit_id?.product_id?.name || "Sản phẩm",
        unit_name: detail.product_unit_id?.unit_id?.name || "",
        quantity: detail.quantity || 0,
        unit_price: Math.round(detail.unit_price || 0),
        line_total: Math.round(detail.total_price || 0),
      })),
    };

    const email = String(payload.email || "").trim();
    if (email) {
      await sendPosReceiptEmail(email, {
        orderCode: receiptData.order_code,
        issuedAt: new Date(receiptData.issued_at).toLocaleString("vi-VN"),
        paymentMethod: receiptData.payment_method,
        paymentStatus: receiptData.payment_status,
        subtotal: receiptData.subtotal,
        tax: receiptData.tax_amount,
        discount: receiptData.discount_amount,
        total: receiptData.final_amount,
        staffName: receiptData.staff_name,
        items: receiptData.items.map((item) => ({
          name: item.unit_name
            ? `${item.product_name} (${item.unit_name})`
            : item.product_name,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          lineTotal: item.line_total,
        })),
      });
    }

    return {
      ...receiptData,
      email_sent: Boolean(email),
      email_to: email || null,
    };
  }
}

module.exports = new PosService();

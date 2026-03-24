const mongoose = require("mongoose");
const Order = require("../../models/Order");
const OrderDetail = require("../../models/OrderDetail");
const Product = require("../../models/Product");
const ProductUnit = require("../../models/ProductUnit");
const ProductBatch = require("../../models/ProductBatch");
const User = require("../../models/User");
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
    });
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

        for (const batch of batches) {
          for (const item of batch.items) {
            if (
              item.product_id.toString() === productId.toString() &&
              item.unit_id.toString() === unitId.toString() &&
              item.status === "onsale" &&
              item.current_quantity > 0
            ) {
              availableStock += item.current_quantity;
            }
          }
        }

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
          price: unit.price,
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
      order,
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
    order.discount_amount = 0;
    order.final_amount = Math.round(order.total_amount + order.tax_amount);
    await order.save();

    return order;
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

    const changeAmount = Math.round(roundedCashReceived - latestOrder.final_amount);

    latestOrder.payment_method = "cod";
    latestOrder.payment_status = "paid";
    latestOrder.order_status = "completed";
    await latestOrder.save();

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

    const staff = await User.findById(order.staff_id).select("username full_name");

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

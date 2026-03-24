const posService = require("../../services/seller_staff/posService");

const posController = {
  async createTransaction(req, res) {
    try {
      const transaction = await posService.createSalesTransaction(req.user._id);
      return res.status(201).json({
        success: true,
        message: "Tạo giao dịch POS thành công",
        data: transaction,
      });
    } catch (error) {
      console.error("POS create transaction error:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Không thể tạo giao dịch POS",
      });
    }
  },

  async getProductList(req, res) {
    try {
      const result = await posService.getProducts({
        search: req.query.search,
        category_id: req.query.category_id,
        min_price: req.query.min_price,
        max_price: req.query.max_price,
        stock_level: req.query.stock_level,
        sort_by: req.query.sort_by,
        order: req.query.order,
        page: req.query.page,
        limit: req.query.limit,
      });

      return res.status(200).json({
        success: true,
        message: "Lấy danh sách sản phẩm thành công",
        data: result,
      });
    } catch (error) {
      console.error("POS get products error:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Không thể lấy danh sách sản phẩm",
      });
    }
  },

  async getCategories(req, res) {
    try {
      const result = await posService.getSellableCategories();
      return res.status(200).json({
        success: true,
        message: "Lấy danh mục bán hàng thành công",
        data: result,
      });
    } catch (error) {
      console.error("POS get categories error:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Không thể lấy danh mục bán hàng",
      });
    }
  },

  async getTransactionDetail(req, res) {
    try {
      const result = await posService.getTransactionById(
        req.params.transactionId,
        req.user._id,
      );

      return res.status(200).json({
        success: true,
        message: "Lấy chi tiết giao dịch thành công",
        data: result,
      });
    } catch (error) {
      console.error("POS get transaction error:", error);
      const status = error.message.includes("không hợp lệ") ? 400 : 404;
      return res.status(status).json({
        success: false,
        message: error.message || "Không thể lấy chi tiết giao dịch",
      });
    }
  },

  async addItem(req, res) {
    try {
      const result = await posService.addProductToTransaction(
        req.params.transactionId,
        req.user._id,
        req.body,
      );

      return res.status(200).json({
        success: true,
        message: "Thêm sản phẩm vào giao dịch thành công",
        data: result,
      });
    } catch (error) {
      console.error("POS add item error:", error);
      const status =
        error.message.includes("không hợp lệ") ||
        error.message.includes("Số lượng")
          ? 400
          : error.message.includes("không tìm thấy")
            ? 404
            : 409;

      return res.status(status).json({
        success: false,
        message: error.message || "Không thể thêm sản phẩm vào giao dịch",
      });
    }
  },

  async removeItem(req, res) {
    try {
      const result = await posService.removeItemFromTransaction(
        req.params.transactionId,
        req.params.itemId,
        req.user._id,
      );

      return res.status(200).json({
        success: true,
        message: "Xóa sản phẩm khỏi giao dịch thành công",
        data: result,
      });
    } catch (error) {
      console.error("POS remove item error:", error);
      const status = error.message.includes("không hợp lệ")
        ? 400
        : error.message.includes("không tìm thấy")
          ? 404
          : 409;

      return res.status(status).json({
        success: false,
        message: error.message || "Không thể xóa sản phẩm khỏi giao dịch",
      });
    }
  },

  async updateItem(req, res) {
    try {
      const result = await posService.updateItemQuantity(
        req.params.transactionId,
        req.params.itemId,
        req.user._id,
        req.body.quantity,
      );

      return res.status(200).json({
        success: true,
        message: "Cập nhật số lượng sản phẩm thành công",
        data: result,
      });
    } catch (error) {
      console.error("POS update item error:", error);
      const status =
        error.message.includes("không hợp lệ") ||
        error.message.includes("Số lượng") ||
        error.message.includes("đã đóng") ||
        error.message.includes("không đủ")
          ? 400
          : error.message.includes("không tìm thấy")
            ? 404
            : 409;

      return res.status(status).json({
        success: false,
        message: error.message || "Không thể cập nhật số lượng sản phẩm",
      });
    }
  },

  async createPayOSPayment(req, res) {
    try {
      const paymentLink = await posService.createPayOSPayment(
        req.params.transactionId,
        req.user._id,
      );

      return res.status(200).json({
        success: true,
        message: "Tạo link thanh toán PayOS thành công",
        data: paymentLink,
      });
    } catch (error) {
      console.error("POS create PayOS payment error:", error);
      const status =
        error.message.includes("chưa có sản phẩm") ||
        error.message.includes("tổng tiền")
          ? 400
          : error.message.includes("không hợp lệ")
            ? 400
            : error.message.includes("không tìm thấy")
              ? 404
              : 409;
      return res.status(status).json({
        success: false,
        message: error.message || "Không thể tạo thanh toán PayOS",
      });
    }
  },

  async completeCashPayment(req, res) {
    try {
      const order = await posService.completeCashPayment(
        req.params.transactionId,
        req.user._id,
      );

      return res.status(200).json({
        success: true,
        message: "Hoàn thành giao dịch tiền mặt thành công",
        data: {
          _id: order._id,
          order_code: order.order_code,
          payment_method: order.payment_method,
          payment_status: order.payment_status,
          order_status: order.order_status,
          final_amount: order.final_amount,
        },
      });
    } catch (error) {
      console.error("POS complete cash payment error:", error);
      const status =
        error.message.includes("chưa có sản phẩm") ||
        error.message.includes("tổng tiền") ||
        error.message.includes("đã được thanh toán") ||
        error.message.includes("không hợp lệ")
          ? 400
          : error.message.includes("không tìm thấy")
            ? 404
            : 409;
      return res.status(status).json({
        success: false,
        message: error.message || "Không thể hoàn thành giao dịch tiền mặt",
      });
    }
  },

  async completeCodPayment(req, res) {
    try {
      const result = await posService.completeCodPayment(
        req.params.transactionId,
        req.user._id,
        req.body,
      );

      return res.status(200).json({
        success: true,
        message: "Hoàn thành giao dịch COD thành công",
        data: {
          _id: result.order._id,
          order_code: result.order.order_code,
          payment_method: result.order.payment_method,
          payment_status: result.order.payment_status,
          order_status: result.order.order_status,
          final_amount: result.order.final_amount,
          cash_received: result.cash_received,
          change_amount: result.change_amount,
        },
      });
    } catch (error) {
      console.error("POS complete COD payment error:", error);
      const status =
        error.message.includes("chưa có sản phẩm") ||
        error.message.includes("tổng tiền") ||
        error.message.includes("đã được thanh toán") ||
        error.message.includes("không hợp lệ") ||
        error.message.includes("Tiền khách đưa")
          ? 400
          : error.message.includes("không đủ")
            ? 409
            : error.message.includes("không tìm thấy")
              ? 404
              : 409;
      return res.status(status).json({
        success: false,
        message: error.message || "Không thể hoàn thành giao dịch COD",
      });
    }
  },

  async checkPaymentStatus(req, res) {
    try {
      const result = await posService.checkAndUpdatePaymentStatus(
        req.params.transactionId,
        req.user._id,
      );

      return res.status(200).json({
        success: true,
        message: "Kiểm tra trạng thái thanh toán thành công",
        data: result,
      });
    } catch (error) {
      console.error("POS check payment status error:", error);
      const status = error.message.includes("không hợp lệ") ? 400 : 404;
      return res.status(status).json({
        success: false,
        message: error.message || "Không thể kiểm tra trạng thái thanh toán",
      });
    }
  },

  async deleteTransaction(req, res) {
    try {
      const order = await posService.deleteTransaction(
        req.params.transactionId,
        req.user._id,
      );

      return res.status(200).json({
        success: true,
        message: "Xóa Sales Transaction thành công",
        data: {
          _id: order._id,
          order_status: order.order_status,
          payment_status: order.payment_status,
        },
      });
    } catch (error) {
      console.error("POS delete transaction error:", error);
      const status =
        error.message.includes("không hợp lệ") ||
        error.message.includes("đã thanh toán")
          ? 400
          : error.message.includes("không tìm thấy")
            ? 404
            : 409;
      return res.status(status).json({
        success: false,
        message: error.message || "Không thể xóa Sales Transaction",
      });
    }
  },

  async issueReceipt(req, res) {
    try {
      const result = await posService.issueReceipt(
        req.params.transactionId,
        req.user._id,
        req.body,
      );

      return res.status(200).json({
        success: true,
        message: result.email_sent
          ? "Xuất biên lai và gửi email thành công"
          : "Xuất biên lai thành công",
        data: result,
      });
    } catch (error) {
      console.error("POS issue receipt error:", error);
      const status =
        error.message.includes("chưa có sản phẩm") ||
        error.message.includes("không hợp lệ")
          ? 400
          : error.message.includes("không tìm thấy")
            ? 404
            : 409;
      return res.status(status).json({
        success: false,
        message: error.message || "Không thể xuất biên lai",
      });
    }
  },
};

module.exports = posController;

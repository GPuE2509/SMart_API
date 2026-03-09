const productBatchService = require("../../services/repository_staff/productBatchService");
const rescuePricingService = require("../../services/rescuePricingService");

/**
 * Get all batches with filters, search, and pagination
 * GET /api/v1/batches
 * Query params: search, product_id, status, sort_by, sort_order, page, limit
 */
exports.getAll = async (req, res) => {
  try {
    const result = await productBatchService.getAllBatches(req.query);

    res.status(200).json({
      success: true,
      message: "Lấy danh sách lô hàng thành công",
      data: result.batches,
      pagination: result.pagination,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách lô hàng",
      error: error.message,
    });
  }
};

/**
 * Get batch by ID with inventory logs
 * GET /api/v1/batches/:id
 */
exports.getById = async (req, res) => {
  try {
    const batch = await productBatchService.getBatchById(req.params.id);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lô hàng",
      });
    }

    res.status(200).json({
      success: true,
      message: "Lấy thông tin lô hàng thành công",
      data: batch,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Không thể lấy thông tin lô hàng",
      error: error.message,
    });
  }
};

/**
 * Import new product batch
 * POST /api/v1/batches/import
 * Body: items[]
 * items: [{ product_id, unit_id, initial_quantity, current_quantity, import_price, manufacture_date, expiry_date, supplier_name }]
 */
exports.importBatch = async (req, res) => {
  try {
    const userId = req.user._id; // From auth middleware
    const batch = await productBatchService.importBatch(req.body, userId);

    res.status(201).json({
      success: true,
      message: "Nhập lô hàng thành công",
      data: batch,
    });
  } catch (error) {
    // Handle validation errors
    const validationErrors = [
      "không tồn tại",
      "phải lớn hơn 0",
      "phải có ít nhất",
      "không thuộc sản phẩm",
      "đã tồn tại",
      "phải sau ngày sản xuất",
    ];

    if (
      validationErrors.some((msg) => error.message.toLowerCase().includes(msg))
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Không thể nhập lô hàng",
      error: error.message,
    });
  }
};

/**
 * Update product batch
 * PUT /api/v1/batches/:id
 * Body: { items: [{ product_id, unit_id, initial_quantity, current_quantity, import_price, manufacture_date, expiry_date, supplier_name }] }
 */
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id; // From auth middleware
    const batch = await productBatchService.updateBatch(id, req.body, userId);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lô hàng",
      });
    }

    res.status(200).json({
      success: true,
      message: "Cập nhật lô hàng thành công",
      data: batch,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Không thể cập nhật lô hàng",
      error: error.message,
    });
  }
};

/**
 * Reject (soft delete) product batch
 * DELETE /api/v1/batches/:id/reject
 * Body: { reason: "optional rejection reason" }
 */
exports.reject = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user._id;

    const batch = await productBatchService.rejectBatch(id, reason, userId);

    res.status(200).json({
      success: true,
      message: "Từ chối lô hàng thành công",
      data: batch,
    });
  } catch (error) {
    if (
      error.message === "Không tìm thấy lô hàng" ||
      error.message === "Lô hàng này đã bị từ chối trước đó"
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Không thể từ chối lô hàng",
      error: error.message,
    });
  }
};

/**
 * Change product batch items status
 * PATCH /api/v1/batches/:id/status
 * Body: { status: "instock" | "outdate" | "onsale" | "sold" }
 * Note: This updates the status for ALL items in the batch
 */
exports.changeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user._id;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp trạng thái mới",
      });
    }

    const batch = await productBatchService.changeStatus(id, status, userId);

    res.status(200).json({
      success: true,
      message: "Thay đổi trạng thái lô hàng thành công",
      data: batch,
    });
  } catch (error) {
    if (
      error.message === "Không tìm thấy lô hàng" ||
      error.message.includes("Trạng thái không hợp lệ") ||
      error.message.includes("Không thể thay đổi")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Không thể thay đổi trạng thái lô hàng",
      error: error.message,
    });
  }
};

/**
 * Get smart replenishment suggestions based on AI analysis
 * GET /api/v1/batches/suggestions/smart
 * Query params: date_from, date_to, days_back
 * Returns intelligent recommendations for restocking based on previous overstocking experience
 */
exports.getSmartSuggestions = async (req, res) => {
  try {
    const { date_from, date_to, days_back } = req.query;
    
    const options = {};
    if (date_from) options.date_from = date_from;
    if (date_to) options.date_to = date_to;
    if (days_back) options.days_back = days_back;

    const result =
      await productBatchService.getSmartReplenishmentSuggestions(options);

    res.status(200).json({
      success: true,
      message: "Lấy gợi ý nhập hàng thông minh thành công",
      data: result.data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Không thể lấy gợi ý nhập hàng",
      error: error.message,
    });
  }
};

/**
 * Toggle rescue pricing for a batch item
 * PATCH /api/v1/batches/:batchId/items/:itemId/rescue-pricing
 * Body: { enabled: true/false }
 */
exports.toggleRescuePricing = async (req, res) => {
  try {
    const { batchId, itemId } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp giá trị enabled (true/false)',
      });
    }

    const result = await rescuePricingService.toggleRescuePricing(
      batchId,
      itemId,
      enabled
    );

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.item,
    });
  } catch (error) {
    if (error.message.includes('Không tìm thấy')) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Không thể thay đổi cài đặt giảm giá cứu hộ',
      error: error.message,
    });
  }
};

/**
 * Get rescue pricing information for a batch item
 * GET /api/v1/batches/:batchId/items/:itemId/rescue-pricing
 */
exports.getRescuePricingInfo = async (req, res) => {
  try {
    const { batchId, itemId } = req.params;

    const info = await rescuePricingService.getRescuePricingInfo(
      batchId,
      itemId
    );

    res.status(200).json({
      success: true,
      message: 'Lấy thông tin giảm giá cứu hộ thành công',
      data: info,
    });
  } catch (error) {
    if (error.message.includes('Không tìm thấy')) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Không thể lấy thông tin giảm giá cứu hộ',
      error: error.message,
    });
  }
};

/**
 * Generate print label for batch item (with rescue pricing)
 * GET /api/v1/batches/:batchId/items/:itemId/label
 */
exports.getPrintLabel = async (req, res) => {
  try {
    const { batchId, itemId } = req.params;

    const ProductBatch = require('../../models/ProductBatch');
    const ProductUnit = require('../../models/ProductUnit');
    
    const batch = await ProductBatch.findById(batchId).populate(
      'items.product_id items.unit_id'
    );

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lô hàng',
      });
    }

    const item = batch.items.id(itemId);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sản phẩm trong lô hàng',
      });
    }

    const product = item.product_id;
    const unit = item.unit_id;

    // Find ProductUnit to get selling price
    const productUnit = await ProductUnit.findOne({
      product_id: product._id,
      unit_id: unit._id,
      is_active: true
    });

    if (!productUnit) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thông tin giá bán của sản phẩm',
      });
    }

    // Calculate final price with rescue discount
    let originalPrice = productUnit.price || 0;
    let finalPrice = originalPrice;
    let discountAmount = 0;
    let discountPercentage = 0;
    let isAutoDiscount = false;

    // Use rescue pricing (auto) if enabled, otherwise use manual discount
    if (item.rescue_pricing_enabled && item.rescue_pricing_active && item.rescue_discount_percentage > 0) {
      discountPercentage = item.rescue_discount_percentage;
      isAutoDiscount = true;
    } else if (!item.rescue_pricing_enabled && item.manual_discount_percentage > 0) {
      discountPercentage = item.manual_discount_percentage;
      isAutoDiscount = false;
    }

    if (discountPercentage > 0) {
      discountAmount = (originalPrice * discountPercentage) / 100;
      finalPrice = originalPrice - discountAmount;
    }

    const labelData = {
      batchCode: batch._id,
      productName: product.name,
      unitName: unit.name,
      originalPrice: originalPrice,
      discountPercentage: discountPercentage,
      discountAmount,
      finalPrice,
      expiryDate: item.expiry_date,
      rescuePricing: discountPercentage > 0, // Has any discount (auto or manual)
      manualDiscount: !item.rescue_pricing_enabled && item.manual_discount_percentage > 0,
      isAutoDiscount: isAutoDiscount,
      importPrice: item.import_price || 0, // Giá nhập (để tham khảo)
    };

    res.status(200).json({
      success: true,
      message: 'Lấy thông tin nhãn thành công',
      data: labelData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Không thể tạo nhãn in',
      error: error.message,
    });
  }
};


/**
 * Set manual discount percentage for a batch item
 * PATCH /api/v1/batches/:batchId/items/:itemId/manual-discount
 * Body: { discountPercentage: number (0-100) }
 */
exports.setManualDiscount = async (req, res) => {
  try {
    const { batchId, itemId } = req.params;
    const { discountPercentage } = req.body;

    if (typeof discountPercentage !== 'number' || discountPercentage < 0 || discountPercentage > 100) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp % giảm giá hợp lệ (0-100)',
      });
    }

    const ProductBatch = require('../../models/ProductBatch');
    const batch = await ProductBatch.findById(batchId);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lô hàng',
      });
    }

    const item = batch.items.id(itemId);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sản phẩm trong lô hàng',
      });
    }

    // Can only set manual discount when rescue pricing is disabled
    if (item.rescue_pricing_enabled) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng tắt giảm giá tự động trước khi đặt % giảm giá thủ công',
      });
    }

    item.manual_discount_percentage = discountPercentage;
    await batch.save();

    res.status(200).json({
      success: true,
      message: 'Đã cập nhật % giảm giá thủ công',
      data: {
        manual_discount_percentage: item.manual_discount_percentage,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Không thể cập nhật % giảm giá',
      error: error.message,
    });
  }
};


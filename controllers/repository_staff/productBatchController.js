const productBatchService = require("../../services/repository_staff/productBatchService");

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
 * items: [{ product_id, unit_id, quantity, import_price, manufacture_date, expiry_date, supplier_name }]
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
 * Body: { items: [{ product_id, unit_id, quantity, import_price, manufacture_date, expiry_date, supplier_name }] }
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

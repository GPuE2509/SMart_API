const productBatchService = require("../../services/admin/productBatchService");

/**
 * Get all product batches with filters, search, and pagination
 * GET /api/v1/product-batches
 * Query params: batch_code, product_id, status, expiry_date_from, expiry_date_to, include_deleted, sort_by, sort_order, page, limit
 */
exports.getAll = async (req, res) => {
  try {
    const result = await productBatchService.getAllBatches(req.query);

    res.json({
      success: true,
      data: result.batches,
      pagination: result.pagination,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get product batch by ID
 * GET /api/v1/product-batches/:id
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
 * Update batch status
 * PATCH /api/v1/product-batches/:id/status
 * Body: { status: 'instock' | 'outdate' | 'onsale' | 'sold' }
 */
exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Trạng thái là bắt buộc",
      });
    }

    const batch = await productBatchService.updateBatchStatus(id, status);

    res.status(200).json({
      success: true,
      message: "Cập nhật trạng thái lô hàng thành công",
      data: batch,
    });
  } catch (error) {
    if (
      error.message.includes("Trạng thái không hợp lệ") ||
      error.message.includes("Không tìm thấy lô hàng") ||
      error.message.includes("Không thể cập nhật")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Không thể cập nhật trạng thái lô hàng",
      error: error.message,
    });
  }
};

/**
 * Reject batch (soft delete)
 * POST /api/v1/product-batches/:id/reject
 * Body: { note: 'Reason for rejection' }
 */
exports.rejectBatch = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const userId = req.user._id;

    const result = await productBatchService.rejectBatch(id, userId, note);

    res.status(200).json({
      success: true,
      message: "Từ chối lô hàng thành công. Đã ghi nhận vào inventory log.",
      data: result,
    });
  } catch (error) {
    if (
      error.message.includes("Không tìm thấy lô hàng") ||
      error.message.includes("đã bị từ chối")
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
 * Get inventory logs for a batch
 * GET /api/v1/product-batches/:id/logs
 */
exports.getBatchLogs = async (req, res) => {
  try {
    const { id } = req.params;
    const logs = await productBatchService.getBatchInventoryLogs(id);

    res.status(200).json({
      success: true,
      message: "Lấy lịch sử kho thành công",
      data: logs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Không thể lấy lịch sử kho",
      error: error.message,
    });
  }
};

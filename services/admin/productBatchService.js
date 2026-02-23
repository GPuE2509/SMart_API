const ProductBatch = require("../../models/ProductBatch");
const InventoryLog = require("../../models/InventoryLog");
const Product = require("../../models/Product");

/**
 * Search/filter product batches
 * @param {Object} filters - Query filters
 * @returns {Object} - Batches list with pagination
 */
exports.getAllBatches = async (filters) => {
  const {
    batch_code,
    product_id,
    status,
    expiry_date_from,
    expiry_date_to,
    include_deleted = false,
    sort_by = "created_at",
    sort_order = "desc",
    page = 1,
    limit = 20,
  } = filters;

  // Build query
  let query = {};

  // By default, exclude soft-deleted batches
  if (include_deleted !== "true" && include_deleted !== true) {
    query.is_deleted = { $ne: true };
  }

  // Filter by batch_code (partial match, case-insensitive)
  if (batch_code) {
    query.batch_code = { $regex: batch_code, $options: "i" };
  }

  // Filter by product_id
  if (product_id) {
    query.product_id = product_id;
  }

  // Filter by status
  if (status) {
    query.status = status;
  }

  // Filter by expiry_date range
  if (expiry_date_from || expiry_date_to) {
    query.expiry_date = {};
    if (expiry_date_from) {
      query.expiry_date.$gte = new Date(expiry_date_from);
    }
    if (expiry_date_to) {
      query.expiry_date.$lte = new Date(expiry_date_to);
    }
  }

  // Build sort
  const sortOrder = sort_order === "asc" ? 1 : -1;
  let sort = {};
  switch (sort_by) {
    case "batch_code":
      sort = { batch_code: sortOrder };
      break;
    case "expiry_date":
      sort = { expiry_date: sortOrder };
      break;
    case "quantity_current":
      sort = { quantity_current: sortOrder };
      break;
    case "created_at":
    default:
      sort = { created_at: sortOrder };
  }

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  const [batches, total] = await Promise.all([
    ProductBatch.find(query)
      .populate("product_id", "name image_url")
      .sort(sort)
      .limit(limitNum)
      .skip(skip)
      .lean(),
    ProductBatch.countDocuments(query),
  ]);

  return {
    batches,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  };
};

/**
 * Get batch by ID
 * @param {String} batchId - Batch ID
 * @returns {Object} - Batch details
 */
exports.getBatchById = async (batchId) => {
  const batch = await ProductBatch.findById(batchId)
    .populate("product_id", "name image_url category_id")
    .populate("deleted_by", "full_name email")
    .lean();

  return batch;
};

/**
 * Update batch status
 * @param {String} batchId - Batch ID
 * @param {String} newStatus - New status (instock, outdate, onsale, sold)
 * @returns {Object} - Updated batch
 */
exports.updateBatchStatus = async (batchId, newStatus) => {
  const validStatuses = ["instock", "outdate", "onsale", "sold"];

  if (!validStatuses.includes(newStatus)) {
    throw new Error(
      `Trạng thái không hợp lệ. Các trạng thái hợp lệ: ${validStatuses.join(", ")}`,
    );
  }

  const batch = await ProductBatch.findById(batchId);

  if (!batch) {
    throw new Error("Không tìm thấy lô hàng");
  }

  if (batch.is_deleted) {
    throw new Error("Không thể cập nhật trạng thái lô hàng đã bị từ chối");
  }

  batch.status = newStatus;
  await batch.save();

  return batch;
};

/**
 * Reject batch (soft delete)
 * Creates an inventory log entry and marks batch as deleted
 * @param {String} batchId - Batch ID
 * @param {String} userId - User ID who performs the rejection
 * @param {String} note - Reason for rejection
 * @returns {Object} - Updated batch and inventory log
 */
exports.rejectBatch = async (batchId, userId, note) => {
  const batch = await ProductBatch.findById(batchId);

  if (!batch) {
    throw new Error("Không tìm thấy lô hàng");
  }

  if (batch.is_deleted) {
    throw new Error("Lô hàng này đã bị từ chối trước đó");
  }

  // Create inventory log for the rejection
  const inventoryLog = await InventoryLog.create({
    product_batch_id: batchId,
    quantity_change: -batch.quantity_current, // Negative to indicate removal
    reason_type: "rejection",
    note: note || "Từ chối lô hàng mới nhập",
    created_by: userId,
  });

  // Soft delete the batch
  batch.is_deleted = true;
  batch.deleted_at = new Date();
  batch.deleted_by = userId;
  batch.status = "rejected";
  batch.quantity_current = 0;
  await batch.save();

  return {
    batch,
    inventoryLog,
  };
};

/**
 * Get inventory logs for a batch
 * @param {String} batchId - Batch ID
 * @returns {Array} - Inventory logs
 */
exports.getBatchInventoryLogs = async (batchId) => {
  const logs = await InventoryLog.find({ product_batch_id: batchId })
    .populate("created_by", "full_name email")
    .sort({ created_at: -1 })
    .lean();

  return logs;
};

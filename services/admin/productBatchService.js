const ProductBatch = require("../../models/ProductBatch");
const InventoryLog = require("../../models/InventoryLog");

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

  // Filter by product_id (check if any item contains this product)
  if (product_id) {
    query["items.product_id"] = product_id;
  }

  // Filter by status
  if (status) {
    query.status = status;
  }

  // Filter by expiry_date range (check if any item matches)
  if (expiry_date_from || expiry_date_to) {
    query["items.expiry_date"] = {};
    if (expiry_date_from) {
      query["items.expiry_date"].$gte = new Date(expiry_date_from);
    }
    if (expiry_date_to) {
      query["items.expiry_date"].$lte = new Date(expiry_date_to);
    }
  }

  // Build sort
  const sortOrder = sort_order === "asc" ? 1 : -1;
  let sort = {};
  switch (sort_by) {
    case "batch_code":
      sort = { batch_code: sortOrder };
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
      .populate("items.product_id", "name image_url")
      .populate("items.unit_id", "name abbreviation")
      .sort(sort)
      .limit(limitNum)
      .skip(skip)
      .lean({ virtuals: true }),
    ProductBatch.countDocuments(query),
  ]);

  // Ensure batch_code is set (same as _id)
  const batchesWithCode = batches.map((batch) => ({
    ...batch,
    batch_code: batch._id,
  }));

  return {
    batches: batchesWithCode,
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
    .populate("items.product_id", "name image_url category_id")
    .populate("items.unit_id", "name abbreviation")
    .populate("deleted_by", "full_name email")
    .lean({ virtuals: true });

  if (batch) {
    batch.batch_code = batch._id;
  }

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

  // Create inventory logs for each item in the batch
  const inventoryLogs = [];
  for (const item of batch.items) {
    const log = await InventoryLog.create({
      product_batch_id: batchId,
      batch_item_id: item._id,
      product_id: item.product_id,
      unit_id: item.unit_id,
      quantity_change: -item.quantity, // Negative to indicate removal
      reason_type: "rejection",
      note: note || "Từ chối lô hàng mới nhập",
      created_by: userId,
    });
    inventoryLogs.push(log);
  }

  // Soft delete the batch
  batch.is_deleted = true;
  batch.deleted_at = new Date();
  batch.deleted_by = userId;
  batch.status = "rejected";
  await batch.save();

  return {
    batch,
    inventoryLogs,
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
    .lean({ virtuals: true });

  return logs;
};

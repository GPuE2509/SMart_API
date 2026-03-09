const ProductBatch = require("../../models/ProductBatch");
const Product = require("../../models/Product");
const ProductUnit = require("../../models/ProductUnit");
const InventoryLog = require("../../models/InventoryLog");
const { generateJSONContent } = require("../../config/gemini");

/**
 * Helper function to remove Vietnamese diacritics
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

/**
 * Helper function to generate batch code: NK-YYMMDD-HHMM
 */
const generateBatchCode = () => {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");

  return `NK-${yy}${mm}${dd}-${hh}${min}`;
};

/**
 * Helper function to update item status based on expiry date
 * Sets date_status (active/near_expiry/expired) for each item automatically
 * Only auto-updates date_status, preserves manual status field
 */
const updateItemStatus = (item) => {
  if (!item.expiry_date) {
    item.date_status = "active";
    return item;
  }

  const now = new Date();
  const expiryDate = new Date(item.expiry_date);
  const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));

  if (daysUntilExpiry < 0) {
    item.date_status = "expired";
  } else if (daysUntilExpiry <= 30) {
    item.date_status = "near_expiry";
  } else {
    item.date_status = "active";
  }

  return item;
};

/**
 * Helper function to compute batch overall status based on items
 * @param {Object} batch - Batch object
 * @returns {String} - Computed status
 */
/**
 * Helper function to compute batch status information
 * @param {Object} batch - Batch object
 * @returns {Object} - { status, status_summary, can_change_status }
 */
const computeBatchStatus = (batch) => {
  if (!batch.items || batch.items.length === 0) {
    return {
      status: "instock",
      status_summary: {},
      can_change_status: true,
    };
  }

  // Count items by status
  const statusCounts = {};
  batch.items.forEach((item) => {
    const status = item.status || "instock";
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  const totalItems = batch.items.length;

  // If all items are sold -> status = "sold", cannot change
  if (statusCounts.sold === totalItems) {
    return {
      status: "sold",
      status_summary: statusCounts,
      can_change_status: false,
    };
  }

  // If any item is rejected -> status = "rejected", cannot change
  if (statusCounts.rejected && statusCounts.rejected > 0) {
    return {
      status: "rejected",
      status_summary: statusCounts,
      can_change_status: false,
    };
  }

  // Primary status is onsale or instock
  // Priority: onsale > instock
  let primaryStatus = "instock";
  if (statusCounts.onsale && statusCounts.onsale > 0) {
    primaryStatus = "onsale";
  }

  return {
    status: primaryStatus,
    status_summary: statusCounts,
    can_change_status: true,
  };
};

/**
 * Helper function to compute batch overall date_status based on items
 * @param {Object} batch - Batch object
 * @returns {String} - Computed date_status
 */
const computeBatchDateStatus = (batch) => {
  if (!batch.items || batch.items.length === 0) return "active";

  // Get all unique date_statuses
  const dateStatuses = [
    ...new Set(batch.items.map((item) => item.date_status)),
  ];

  // If all items have the same date_status, use that
  if (dateStatuses.length === 1) {
    return dateStatuses[0];
  }

  // Priority order: expired > near_expiry > active
  // If there are multiple date_statuses, use the highest priority one
  if (dateStatuses.includes("expired")) return "expired";
  if (dateStatuses.includes("near_expiry")) return "near_expiry";
  return "active";
};

/**
 * Helper function to update all items' date_status in a batch
 * @param {Object} batch - Batch object
 * @returns {Object} - Updated batch
 */
const updateBatchStatus = (batch) => {
  if (!batch.items || batch.items.length === 0) return batch;

  // Update date_status for each item based on expiry date
  batch.items = batch.items.map(updateItemStatus);

  // Compute batch status information
  const batchStatusInfo = computeBatchStatus(batch);
  batch.status = batchStatusInfo.status;
  batch.status_summary = batchStatusInfo.status_summary;
  batch.can_change_status = batchStatusInfo.can_change_status;
  batch.date_status = computeBatchDateStatus(batch);

  return batch;
};

/**
 * Get all product batches with filters, search, and pagination
 * @param {Object} filters - { search, product_id, status, expiry_date_from, expiry_date_to, include_deleted, sort_by, sort_order, page, limit }
 * @returns {Object} - { batches, pagination }
 */
exports.getAllBatches = async (filters) => {
  const {
    search,
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

  // Filter out soft-deleted batches by default
  if (include_deleted !== "true" && include_deleted !== true) {
    query.is_deleted = { $ne: true };
  }

  // Filter by product (check if any item contains this product)
  if (product_id) {
    query["items.product_id"] = product_id;
  }

  // Filter by status (filter items by status or date_status)
  if (status && status !== "all") {
    // Check if status is a manual status or date_status
    const manualStatuses = ["instock", "outdate", "onsale", "sold", "rejected"];
    const dateStatuses = ["active", "near_expiry", "expired"];

    if (manualStatuses.includes(status)) {
      query["items.status"] = status;
    } else if (dateStatuses.includes(status)) {
      query["items.date_status"] = status;
    }
  }

  // Filter by expiry_date range
  if (expiry_date_from || expiry_date_to) {
    const dateFilter = {};
    if (expiry_date_from) {
      dateFilter.$gte = new Date(expiry_date_from);
    }
    if (expiry_date_to) {
      dateFilter.$lte = new Date(expiry_date_to);
    }
    query["items.expiry_date"] = dateFilter;
  }

  // Get all batches matching base filters
  let batches = await ProductBatch.find(query)
    .populate("items.product_id", "name image_url category_id")
    .populate("items.unit_id", "name abbreviation")
    .lean({ virtuals: true });

  // Ensure batch_code is set
  batches = batches.map((batch) => ({
    ...batch,
    batch_code: batch._id,
  }));

  // Update status based on expiry date
  batches = batches.map(updateBatchStatus);

  // Search by batch code, supplier name, or product name
  if (search) {
    const searchNormalized = removeVietnameseDiacritics(search);
    batches = batches.filter((b) => {
      const batchCodeNormalized = removeVietnameseDiacritics(
        b.batch_code || "",
      );

      // Search in items product names
      const hasMatchingProduct = b.items?.some((item) => {
        const productNameNormalized = removeVietnameseDiacritics(
          item.product_id?.name || "",
        );
        return productNameNormalized.includes(searchNormalized);
      });

      // Search in items supplier names
      const hasMatchingSupplier = b.items?.some((item) => {
        const supplierNormalized = removeVietnameseDiacritics(
          item.supplier_name || "",
        );
        return supplierNormalized.includes(searchNormalized);
      });

      return (
        batchCodeNormalized.includes(searchNormalized) ||
        hasMatchingProduct ||
        hasMatchingSupplier
      );
    });
  }

  // Sort batches
  const sortMultiplier = sort_order === "desc" ? -1 : 1;
  switch (sort_by) {
    case "batch_code":
      batches.sort(
        (a, b) =>
          sortMultiplier *
          (a.batch_code || "").localeCompare(b.batch_code || ""),
      );
      break;
    case "expiry_date":
      batches.sort((a, b) => {
        if (!a.expiry_date) return 1;
        if (!b.expiry_date) return -1;
        return (
          sortMultiplier * (new Date(a.expiry_date) - new Date(b.expiry_date))
        );
      });
      break;
    case "created_at":
    default:
      batches.sort(
        (a, b) =>
          sortMultiplier * (new Date(b.created_at) - new Date(a.created_at)),
      );
  }

  // Pagination
  const total = batches.length;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;
  const paginatedBatches = batches.slice(skip, skip + limitNum);

  return {
    batches: paginatedBatches,
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
 * @param {String} id - Batch ID
 * @returns {Object} - Batch
 */
exports.getBatchById = async (id) => {
  let batch = await ProductBatch.findById(id)
    .populate("items.product_id", "name image_url category_id")
    .populate("items.unit_id", "name abbreviation")
    .lean({ virtuals: true });

  if (!batch) {
    return null;
  }

  // Ensure batch_code is set
  batch.batch_code = batch._id;

  // Fetch exchange_value for each item's unit
  for (let item of batch.items) {
    if (item.product_id && item.unit_id) {
      const productUnit = await ProductUnit.findOne({
        product_id: item.product_id._id,
        unit_id: item.unit_id._id,
      }).select("exchange_value");

      if (productUnit) {
        item.exchange_value = productUnit.exchange_value;
      }
    }
  }

  // Update status based on expiry date
  batch = updateBatchStatus(batch);

  // If batch is deleted (rejected), fetch rejection reason from InventoryLog
  if (batch.is_deleted) {
    const rejectionLog = await InventoryLog.findOne({
      product_batch_id: batch._id,
      reason_type: "batch_rejection",
    })
      .select("note created_at created_by")
      .populate("created_by", "name email")
      .sort({ created_at: 1 }); // Get the first rejection log

    if (rejectionLog) {
      batch.rejection_note = rejectionLog.note;
      batch.rejection_date = rejectionLog.created_at;
      batch.rejection_by = rejectionLog.created_by;
    }
  }

  return batch;
};

/**
 * Import new product batch with multiple items
 * @param {Object} batchData - Batch data
 * @param {String} userId - User ID who imported
 * @returns {Object} - Created batch
 */
exports.importBatch = async (batchData, userId) => {
  const { items } = batchData;

  // Validate items array
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error("Lô hàng phải có ít nhất 1 sản phẩm");
  }

  // Validate each item
  for (const item of items) {
    // Check product exists
    const product = await Product.findById(item.product_id);
    if (!product) {
      throw new Error(`Sản phẩm ${item.product_id} không tồn tại`);
    }

    // Check product unit exists by product_id and unit_id
    const productUnit = await ProductUnit.findOne({
      product_id: item.product_id,
      unit_id: item.unit_id,
    });

    if (!productUnit) {
      throw new Error(`Đơn vị sản phẩm không tồn tại cho ${product.name}`);
    }

    // Validate initial_quantity
    if (!item.initial_quantity || item.initial_quantity <= 0) {
      throw new Error(`Số lượng của ${product.name} phải lớn hơn 0`);
    }

    // Validate manufacture_date is required
    if (!item.manufacture_date) {
      throw new Error(`Ngày sản xuất của ${product.name} là bắt buộc`);
    }

    // Validate manufacture_date not in future
    const mfgDate = new Date(item.manufacture_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    mfgDate.setHours(0, 0, 0, 0);

    if (mfgDate > today) {
      throw new Error(
        `Ngày sản xuất của ${product.name} không được ở tương lai`,
      );
    }

    // Validate expiry_date is required
    if (!item.expiry_date) {
      throw new Error(`Hạn sử dụng của ${product.name} là bắt buộc`);
    }

    // Validate expiry_date not in past
    const expDate = new Date(item.expiry_date);
    expDate.setHours(0, 0, 0, 0);

    if (expDate < today) {
      throw new Error(`Hạn sử dụng của ${product.name} không được ở quá khứ`);
    }

    // Validate expiry date is after manufacture date
    const diffInDays = Math.ceil((expDate - mfgDate) / (1000 * 60 * 60 * 24));

    if (diffInDays < 1) {
      throw new Error(
        `Hạn sử dụng của ${product.name} phải sau ngày sản xuất ít nhất 1 ngày`,
      );
    }
  }

  // Generate batch code
  const batch_code = generateBatchCode();

  // Create batch
  let batch = new ProductBatch({
    _id: batch_code,
    items: items.map((item) => ({
      product_id: item.product_id,
      unit_id: item.unit_id,
      initial_quantity: item.initial_quantity,
      current_quantity: item.current_quantity || item.initial_quantity,
      import_price: item.import_price || 0,
      manufacture_date: item.manufacture_date || null,
      expiry_date: item.expiry_date || null,
      supplier_name: item.supplier_name || "",
      date_status: "active", // Will be updated by updateBatchStatus
      status: "instock", // Default manual status
    })),
  });

  // Update date_status based on expiry date for all items
  batch = updateBatchStatus(batch);
  await batch.save();

  // Create inventory logs and update product stock for each item
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const savedItem = batch.items[i]; // Get the saved item with _id

    // Create inventory log with batch_item_id
    await InventoryLog.create({
      product_batch_id: batch.batch_code,
      batch_item_id: savedItem._id,
      product_id: item.product_id,
      unit_id: item.unit_id,
      quantity_change: item.initial_quantity,
      reason_type: "import",
      note: `Nhập lô hàng mới ${batch_code} từ ${item.supplier_name || "nhà cung cấp"}`,
      created_by: userId,
    });

    // Update product total stock (convert to base unit if necessary)
    const product = await Product.findById(item.product_id);
    const productUnit = await ProductUnit.findOne({
      product_id: item.product_id,
      unit_id: item.unit_id,
    });

    if (product && productUnit) {
      // Calculate quantity in base unit
      const quantityInBaseUnit =
        item.initial_quantity * productUnit.exchange_value;
      product.total_stock = (product.total_stock || 0) + quantityInBaseUnit;
      await product.save();
    }
  }

  return batch;
};

/**
 * Update product batch items (quantity, price, dates)
 * @param {String} id - Batch ID
 * @param {Object} batchData - Updated data { items: [] }
 * @param {String} userId - User ID who updated
 * @returns {Object} - Updated batch
 */
exports.updateBatch = async (id, batchData, userId) => {
  let batch = await ProductBatch.findById(id);

  if (!batch) {
    return null;
  }

  // If items data provided, update items
  if (batchData.items && Array.isArray(batchData.items)) {
    // Process each item update
    for (let i = 0; i < batchData.items.length; i++) {
      const newItem = batchData.items[i];
      const oldItem = batch.items[i];

      if (!oldItem) continue;

      // Validate manufacture_date not in future
      if (newItem.manufacture_date) {
        const mfgDate = new Date(newItem.manufacture_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        mfgDate.setHours(0, 0, 0, 0);

        if (mfgDate > today) {
          throw new Error("Ngày sản xuất không được ở tương lai");
        }
      }

      // Validate expiry_date not in past
      if (newItem.expiry_date) {
        const expDate = new Date(newItem.expiry_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        expDate.setHours(0, 0, 0, 0);

        if (expDate < today) {
          throw new Error("Hạn sử dụng không được ở quá khứ");
        }
      }

      // Validate expiry date is after manufacture date
      if (newItem.manufacture_date && newItem.expiry_date) {
        const mfgDate = new Date(newItem.manufacture_date);
        const expDate = new Date(newItem.expiry_date);
        const diffInDays = Math.ceil(
          (expDate - mfgDate) / (1000 * 60 * 60 * 24),
        );

        if (diffInDays < 1) {
          throw new Error("Hạn sử dụng phải sau ngày sản xuất ít nhất 1 ngày");
        }
      }

      // Check if initial_quantity or current_quantity changed
      const initialQuantityDiff =
        newItem.initial_quantity - oldItem.initial_quantity;
      const currentQuantityDiff =
        newItem.current_quantity - oldItem.current_quantity;

      if (initialQuantityDiff !== 0 || currentQuantityDiff !== 0) {
        // Create inventory log for quantity change (based on current_quantity change)
        if (currentQuantityDiff !== 0) {
          await InventoryLog.create({
            product_batch_id: batch.batch_code,
            batch_item_id: oldItem._id,
            product_id: newItem.product_id,
            unit_id: newItem.unit_id,
            quantity_change: currentQuantityDiff,
            reason_type: "adjustment",
            note: `Điều chỉnh số lượng hiện tại lô ${batch.batch_code}: ${oldItem.current_quantity} → ${newItem.current_quantity} (${currentQuantityDiff > 0 ? "+" : ""}${currentQuantityDiff})`,
            created_by: userId,
          });

          // Update product total stock
          const product = await Product.findById(newItem.product_id);
          const productUnit = await ProductUnit.findOne({
            product_id: newItem.product_id,
            unit_id: newItem.unit_id,
          });

          if (product && productUnit) {
            const quantityInBaseUnit =
              currentQuantityDiff * productUnit.exchange_value;
            product.total_stock =
              (product.total_stock || 0) + quantityInBaseUnit;
            await product.save();
          }
        }
      }

      // Update item fields (preserve sold/rejected status)
      batch.items[i] = {
        product_id: newItem.product_id,
        unit_id: newItem.unit_id,
        initial_quantity: newItem.initial_quantity,
        current_quantity: newItem.current_quantity,
        import_price: newItem.import_price,
        manufacture_date: newItem.manufacture_date,
        expiry_date: newItem.expiry_date,
        supplier_name: newItem.supplier_name,
        // Preserve sold/rejected status, cannot be changed via update
        status: (oldItem.status === "sold" || oldItem.status === "rejected") ? oldItem.status : (oldItem.status || "instock"),
        date_status: oldItem.date_status || "active", // Will be updated by updateBatchStatus
      };
    }
  }

  // Update date_status based on items' expiry dates
  batch = updateBatchStatus(batch);
  await batch.save();

  return batch;
};

/**
 * Soft delete (reject) a product batch
 * @param {String} batchId - Batch ID
 * @param {String} reason - Rejection reason
 * @param {ObjectId} userId - User performing the rejection
 * @returns {Object} - Rejected batch
 */
exports.rejectBatch = async (batchId, reason, userId) => {
  const batch = await ProductBatch.findById(batchId);

  if (!batch) {
    throw new Error("Không tìm thấy lô hàng");
  }

  if (batch.is_deleted) {
    throw new Error("Lô hàng này đã bị từ chối trước đó");
  }

  // Create inventory logs for each item in the batch (skip sold items)
  for (const item of batch.items) {
    // Skip sold items - they're already out of inventory
    if (item.status === "sold") {
      continue;
    }

    // Only create log and update stock for non-sold items
    if (item.current_quantity > 0) {
      await InventoryLog.create({
        product_batch_id: batch._id,
        batch_item_id: item._id,
        product_id: item.product_id,
        unit_id: item.unit_id,
        quantity_change: -item.current_quantity,
        reason_type: "batch_rejection",
        note: reason || `Từ chối lô hàng ${batch._id}`,
        created_by: userId,
      });

      // Update product total stock
      const product = await Product.findById(item.product_id);
      const productUnit = await ProductUnit.findOne({
        product_id: item.product_id,
        unit_id: item.unit_id,
      });

      if (product && productUnit) {
        const quantityInBaseUnit =
          item.current_quantity * productUnit.exchange_value;
        product.total_stock = Math.max(
          0,
          (product.total_stock || 0) - quantityInBaseUnit,
        );
        await product.save();
      }
    }
  }

  // Soft delete the batch
  batch.is_deleted = true;
  batch.deleted_at = new Date();
  batch.deleted_by = userId;

  // Set items status to rejected (except sold items - they're already sold to customers)
  batch.items = batch.items.map((item) => {
    // Keep sold items unchanged - can't reject what's already sold
    if (item.status === "sold") {
      return item;
    }
    
    // Reject all other items
    return {
      ...item,
      status: "rejected",
    };
  });

  await batch.save();

  return batch;
};

/**
 * Change product batch items status
 * @param {String} batchId - Batch ID
 * @param {String} newStatus - New status for items (only "instock" or "onsale" allowed)
 * @param {ObjectId} userId - User performing the change
 * @returns {Object} - Updated batch
 */
exports.changeStatus = async (batchId, newStatus, userId) => {
  // Only allow changing to instock or onsale
  const validStatuses = ["instock", "onsale"];

  if (!validStatuses.includes(newStatus)) {
    throw new Error(
      `Trạng thái không hợp lệ. Chỉ có thể đổi sang: ${validStatuses.join(", ")}`,
    );
  }

  const batch = await ProductBatch.findById(batchId);

  if (!batch) {
    throw new Error("Không tìm thấy lô hàng");
  }

  if (batch.is_deleted) {
    throw new Error("Không thể thay đổi trạng thái lô hàng đã bị từ chối");
  }

  // Check if batch has any rejected items - cannot change status if rejected
  const hasRejectedItems = batch.items.some(
    (item) => item.status === "rejected",
  );
  if (hasRejectedItems) {
    throw new Error(
      "Không thể thay đổi trạng thái lô hàng đã có sản phẩm bị từ chối",
    );
  }

  // Check if all items are sold - cannot change status
  const allSold = batch.items.every((item) => item.status === "sold");
  if (allSold) {
    throw new Error("Không thể thay đổi trạng thái lô hàng đã bán hết");
  }

  // Count items that will be updated
  let updatedCount = 0;
  const unchangedStatuses = ["sold", "rejected", "outdate"]; // Don't change these statuses

  // Update status only for items that are not sold, rejected, or outdate
  batch.items = batch.items.map((item) => {
    // Keep sold, rejected, and outdate items unchanged
    if (unchangedStatuses.includes(item.status)) {
      return item;
    }

    // Update status for instock/onsale items only
    updatedCount++;
    return {
      ...item,
      status: newStatus,
    };
  });

  await batch.save();

  // Create inventory log for status change
  await InventoryLog.create({
    product_batch_id: batch._id,
    quantity_change: 0,
    reason_type: "adjustment",
    note: `Thay đổi trạng thái lô hàng sang ${newStatus} (${updatedCount} sản phẩm được cập nhật, bỏ qua sản phẩm đã sold/rejected/outdate)`,
    created_by: userId,
  });

  return batch;
};

exports.getSmartReplenishmentSuggestions = async (options = {}) => {

  // Calculate date range for analysis
  const dateRange = {};
  
  if (options.date_from && options.date_to) {
    // Use custom date range
    dateRange.created_at = {
      $gte: new Date(options.date_from),
      $lte: new Date(options.date_to),
    };
  } else if (options.days_back) {
    // Use days_back parameter (default: 90 days)
    const daysBack = parseInt(options.days_back) || 90;
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysBack);
    dateRange.created_at = { $gte: fromDate };
  } else {
    // Default: last 90 days
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 90);
    dateRange.created_at = { $gte: fromDate };
  }

  // Get batches within date range
  const allBatches = await ProductBatch.find(dateRange)
    .populate("items.product_id", "name category_id total_stock")
    .populate("items.unit_id", "name abbreviation")
    .lean();

  // Get inventory logs within date range
  const logQuery = {
    reason_type: { $in: ["expired_disposal", "damaged", "batch_rejection"] },
  };
  
  if (dateRange.created_at) {
    logQuery.created_at = dateRange.created_at;
  }

  const inventoryLogs = await InventoryLog.find(logQuery)
    .populate("product_id", "name")
    .sort({ created_at: -1 })
    .limit(200)
    .lean();

  // Analyze overstocking patterns by product
  const productAnalysis = {};

  allBatches.forEach((batch) => {
    batch.items.forEach((item) => {
      if (!item.product_id) return;

      const productId = item.product_id._id.toString();
      const productName = item.product_id.name;

      if (!productAnalysis[productId]) {
        productAnalysis[productId] = {
          product_id: productId,
          product_name: productName,
          total_stock: item.product_id.total_stock || 0,
          total_imported: 0,
          total_expired: 0,
          total_outdate: 0,
          total_rejected: 0,
          import_history: [],
          waste_rate: 0,
        };
      }

      // Track import history
      productAnalysis[productId].import_history.push({
        batch_code: batch._id,
        quantity: item.initial_quantity,
        current_quantity: item.current_quantity,
        status: item.status,
        date_status: item.date_status,
        import_date: batch.created_at,
        expiry_date: item.expiry_date,
      });

      productAnalysis[productId].total_imported += item.initial_quantity;

      // Track waste (expired, outdate, rejected)
      if (item.date_status === "expired") {
        productAnalysis[productId].total_expired += item.current_quantity;
      }
      if (item.status === "outdate") {
        productAnalysis[productId].total_outdate += item.current_quantity;
      }
      if (item.status === "rejected") {
        productAnalysis[productId].total_rejected += item.current_quantity;
      }
    });
  });

  // Calculate waste rates
  Object.keys(productAnalysis).forEach((productId) => {
    const data = productAnalysis[productId];
    const totalWaste =
      data.total_expired + data.total_outdate + data.total_rejected;
    data.waste_rate = data.total_imported > 0 ? totalWaste / data.total_imported : 0;
  });

  // Filter products with high waste rates or current stock issues
  const problematicProducts = Object.values(productAnalysis).filter(
    (p) => p.waste_rate > 0.05 || p.total_expired > 0 || p.total_outdate > 0,
  );

  // Prepare data for AI analysis
  const aiPrompt = `Bạn là một chuyên gia quản lý kho hàng. Phân tích dữ liệu lịch sử nhập hàng và đưa ra gợi ý thông minh về số lượng nên nhập cho từng sản phẩm để tránh tình trạng nhập hàng quá mức (overstocking).

Dữ liệu lịch sử:
${JSON.stringify(problematicProducts, null, 2)}

Dữ liệu phụ (logs về hàng hỏng/hết hạn):
${JSON.stringify(inventoryLogs.slice(0, 20), null, 2)}

Hãy đưa ra gợi ý dưới dạng JSON với cấu trúc sau:
{
  "suggestions": [
    {
      "product_id": "id_sản_phẩm",
      "product_name": "tên_sản_phẩm",
      "current_stock": số_lượng_hiện_tại,
      "recommended_quantity": số_lượng_nên_nhập,
      "reasoning": "lý_do_chi_tiết",
      "waste_rate": tỷ_lệ_hao_hụt,
      "priority": "high" | "medium" | "low",
      "warning": "cảnh_báo_nếu_có"
    }
  ],
  "overall_analysis": {
    "total_waste_value_estimate": giá_trị_ước_tính_hao_hụt,
    "key_insights": ["insight1", "insight2", "insight3"],
    "best_practices": ["practice1", "practice2"]
  }
}

Lưu ý:
- Nếu waste_rate > 20%: priority = "high" và khuyến nghị giảm số lượng nhập
- Nếu waste_rate 10-20%: priority = "medium" và điều chỉnh vừa phải
- Nếu waste_rate < 10%: priority = "low"
- Xem xét total_stock hiện tại để đưa ra khuyến nghị phù hợp
- Đưa ra số lượng cụ thể, không chỉ nói "giảm" hay "tăng"
- Chỉ trả về JSON, không có text thừa

Khoảng thời gian phân tích: ${dateRange.created_at ? `Từ ${new Date(dateRange.created_at.$gte).toLocaleDateString('vi-VN')} đến ${dateRange.created_at.$lte ? new Date(dateRange.created_at.$lte).toLocaleDateString('vi-VN') : 'hiện tại'}` : 'Toàn bộ lịch sử'}
Số lô hàng phân tích: ${allBatches.length}
Số log phân tích: ${inventoryLogs.length}`;

  try {
    const aiResponse = await generateJSONContent(aiPrompt);

    return {
      success: true,
      data: {
        suggestions: aiResponse.suggestions || [],
        analysis: aiResponse.overall_analysis || {},
        product_analysis: problematicProducts,
        date_range: {
          from: dateRange.created_at?.$gte || null,
          to: dateRange.created_at?.$lte || null,
          days_analyzed: options.days_back || 90,
        },
        stats: {
          total_batches: allBatches.length,
          total_logs: inventoryLogs.length,
          products_analyzed: problematicProducts.length,
        },
        timestamp: new Date(),
      },
    };
  } catch (error) {
    console.error("Error getting AI suggestions:", error);

    // Fallback to rule-based suggestions if AI fails
    const fallbackSuggestions = problematicProducts.map((p) => ({
      product_id: p.product_id,
      product_name: p.product_name,
      current_stock: p.total_stock,
      recommended_quantity: Math.max(
        0,
        Math.floor(p.total_imported * (1 - p.waste_rate) * 0.5),
      ),
      reasoning: `Dựa trên tỷ lệ hao hụt ${(p.waste_rate * 100).toFixed(1)}%, khuyến nghị giảm số lượng nhập để tránh tồn kho`,
      waste_rate: p.waste_rate,
      priority:
        p.waste_rate > 0.2 ? "high" : p.waste_rate > 0.1 ? "medium" : "low",
      warning:
        p.waste_rate > 0.2
          ? "Sản phẩm có tỷ lệ hao hụt cao, cần xem xét lại chiến lược nhập hàng"
          : null,
    }));

    return {
      success: true,
      data: {
        suggestions: fallbackSuggestions,
        analysis: {
          total_waste_value_estimate: 0,
          key_insights: [
            "AI tạm thời không khả dụng, sử dụng gợi ý dựa trên quy tắc",
          ],
          best_practices: [
            "Theo dõi hạn sử dụng sản phẩm thường xuyên",
            "Nhập hàng dựa trên dự báo nhu cầu thực tế",
          ],
        },
        product_analysis: problematicProducts,
        date_range: {
          from: dateRange.created_at?.$gte || null,
          to: dateRange.created_at?.$lte || null,
          days_analyzed: options.days_back || 90,
        },
        stats: {
          total_batches: allBatches.length,
          total_logs: inventoryLogs.length,
          products_analyzed: problematicProducts.length,
        },
        timestamp: new Date(),
        fallback: true,
      },
    };
  }
};

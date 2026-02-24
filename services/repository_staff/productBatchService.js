const ProductBatch = require("../../models/ProductBatch");
const Product = require("../../models/Product");
const ProductUnit = require("../../models/ProductUnit");
const InventoryLog = require("../../models/InventoryLog");

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
 * Helper function to update batch status based on items' expiry dates
 * Only auto-updates if current status is 'active', 'near_expiry', or 'expired'
 * Preserves manual statuses: instock, outdate, onsale, sold, rejected
 */
const updateBatchStatus = (batch) => {
  if (!batch.items || batch.items.length === 0) return batch;

  // Manual statuses that should NOT be overwritten by expiry date calculation
  const manualStatuses = ["instock", "outdate", "onsale", "sold", "rejected"];
  if (manualStatuses.includes(batch.status)) {
    return batch; // Keep the manual status unchanged
  }

  const now = new Date();
  let hasExpired = false;
  let hasNearExpiry = false;

  // Check each item's expiry date
  for (const item of batch.items) {
    if (item.expiry_date) {
      const expiryDate = new Date(item.expiry_date);
      const daysUntilExpiry = Math.ceil(
        (expiryDate - now) / (1000 * 60 * 60 * 24),
      );

      if (daysUntilExpiry < 0) {
        hasExpired = true;
        break; // If any item expired, batch is expired
      } else if (daysUntilExpiry <= 30) {
        hasNearExpiry = true;
      }
    }
  }

  if (hasExpired) {
    batch.status = "expired";
  } else if (hasNearExpiry) {
    batch.status = "near_expiry";
  } else {
    batch.status = "active";
  }

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
  // But if filtering by 'rejected' status, include deleted batches
  if (status === "rejected") {
    // Show rejected batches (which have is_deleted = true)
    query.is_deleted = true;
    query.status = "rejected";
  } else if (include_deleted !== "true" && include_deleted !== true) {
    query.is_deleted = { $ne: true };
  }

  // Filter by product (check if any item contains this product)
  if (product_id) {
    query["items.product_id"] = product_id;
  }

  // Filter by status (only if not already set for rejected)
  if (status && status !== "all" && status !== "rejected") {
    query.status = status;
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

    // Validate quantity
    if (!item.quantity || item.quantity <= 0) {
      throw new Error(`Số lượng của ${product.name} phải lớn hơn 0`);
    }

    // Validate manufacture_date not in future
    if (item.manufacture_date) {
      const mfgDate = new Date(item.manufacture_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      mfgDate.setHours(0, 0, 0, 0);

      if (mfgDate > today) {
        throw new Error(
          `Ngày sản xuất của ${product.name} không được ở tương lai`,
        );
      }
    }

    // Validate expiry_date not in past
    if (item.expiry_date) {
      const expDate = new Date(item.expiry_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      expDate.setHours(0, 0, 0, 0);

      if (expDate < today) {
        throw new Error(`Hạn sử dụng của ${product.name} không được ở quá khứ`);
      }
    }

    // Validate expiry date is after manufacture date for this item
    if (item.manufacture_date && item.expiry_date) {
      const mfgDate = new Date(item.manufacture_date);
      const expDate = new Date(item.expiry_date);
      const diffInDays = Math.ceil((expDate - mfgDate) / (1000 * 60 * 60 * 24));

      if (diffInDays < 1) {
        throw new Error(
          `Hạn sử dụng của ${product.name} phải sau ngày sản xuất ít nhất 1 ngày`,
        );
      }
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
      quantity: item.quantity,
      import_price: item.import_price || 0,
      manufacture_date: item.manufacture_date || null,
      expiry_date: item.expiry_date || null,
      supplier_name: item.supplier_name || "",
    })),
  });

  // Update status based on expiry date (check all items)
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
      quantity_change: item.quantity,
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
      const quantityInBaseUnit = item.quantity * productUnit.exchange_value;
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

      // Check if quantity changed
      const quantityDiff = newItem.quantity - oldItem.quantity;

      if (quantityDiff !== 0) {
        // Create inventory log for quantity change
        await InventoryLog.create({
          product_batch_id: batch.batch_code,
          batch_item_id: oldItem._id,
          product_id: newItem.product_id,
          unit_id: newItem.unit_id,
          quantity_change: quantityDiff,
          reason_type: "adjustment",
          note: `Điều chỉnh số lượng lô ${batch.batch_code}: ${oldItem.quantity} → ${newItem.quantity} (${quantityDiff > 0 ? "+" : ""}${quantityDiff})`,
          created_by: userId,
        });

        // Update product total stock
        const product = await Product.findById(newItem.product_id);
        const productUnit = await ProductUnit.findOne({
          product_id: newItem.product_id,
          unit_id: newItem.unit_id,
        });

        if (product && productUnit) {
          const quantityInBaseUnit = quantityDiff * productUnit.exchange_value;
          product.total_stock = (product.total_stock || 0) + quantityInBaseUnit;
          await product.save();
        }
      }

      // Update item fields
      batch.items[i] = {
        product_id: newItem.product_id,
        unit_id: newItem.unit_id,
        quantity: newItem.quantity,
        import_price: newItem.import_price,
        manufacture_date: newItem.manufacture_date,
        expiry_date: newItem.expiry_date,
        supplier_name: newItem.supplier_name,
      };
    }
  }

  // Update status based on items' expiry dates
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

  // Create inventory logs for each item in the batch
  for (const item of batch.items) {
    await InventoryLog.create({
      product_batch_id: batch._id,
      batch_item_id: item._id,
      product_id: item.product_id,
      unit_id: item.unit_id,
      quantity_change: -item.quantity,
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
      const quantityInBaseUnit = item.quantity * productUnit.exchange_value;
      product.total_stock = Math.max(
        0,
        (product.total_stock || 0) - quantityInBaseUnit,
      );
      await product.save();
    }
  }

  // Soft delete the batch
  batch.is_deleted = true;
  batch.deleted_at = new Date();
  batch.deleted_by = userId;
  batch.status = "rejected";
  await batch.save();

  return batch;
};

/**
 * Change product batch status
 * @param {String} batchId - Batch ID
 * @param {String} newStatus - New status
 * @param {ObjectId} userId - User performing the change
 * @returns {Object} - Updated batch
 */
exports.changeStatus = async (batchId, newStatus, userId) => {
  const validStatuses = [
    "instock",
    "outdate",
    "onsale",
    "sold",
    "near_expiry",
    "expired",
  ];

  if (!validStatuses.includes(newStatus)) {
    throw new Error(
      `Trạng thái không hợp lệ. Chỉ chấp nhận: ${validStatuses.join(", ")}`,
    );
  }

  const batch = await ProductBatch.findById(batchId);

  if (!batch) {
    throw new Error("Không tìm thấy lô hàng");
  }

  if (batch.is_deleted) {
    throw new Error("Không thể thay đổi trạng thái lô hàng đã bị từ chối");
  }

  const oldStatus = batch.status;
  batch.status = newStatus;
  await batch.save();

  // Create inventory log for status change
  await InventoryLog.create({
    product_batch_id: batch._id,
    quantity_change: 0,
    reason_type: "adjustment",
    note: `Thay đổi trạng thái lô hàng: ${oldStatus} → ${newStatus}`,
    created_by: userId,
  });

  return batch;
};

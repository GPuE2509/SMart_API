const Coupon = require("../../models/Coupon");

/**
 * Get all coupons with filters and pagination
 * @param {Object} filters - Query filters
 * @returns {Object} - Coupons list with pagination
 */
exports.getAllCoupons = async (filters) => {
  const {
    code,
    status,
    discount_type,
    is_expired,
    sort_by = "createdAt",
    sort_order = "desc",
    page = 1,
    limit = 20,
  } = filters;

  // Build query
  let query = {};

  // Filter by code (partial match, case-insensitive)
  if (code) {
    query.code = { $regex: code, $options: "i" };
  }

  // Filter by status
  if (status) {
    query.status = status;
  }

  // Filter by discount_type
  if (discount_type) {
    query.discount_type = discount_type;
  }

  // Filter by expiration status
  if (is_expired !== undefined && is_expired !== null && is_expired !== "") {
    const now = new Date();
    if (is_expired === "true" || is_expired === true) {
      // Show only expired coupons (end_date exists and < now)
      query.end_date = { $exists: true, $ne: null, $lt: now };
    } else if (is_expired === "false" || is_expired === false) {
      // Show only non-expired coupons (end_date >= now OR end_date is null/not exists)
      query.$or = [
        { end_date: { $gte: now } },
        { end_date: null },
        { end_date: { $exists: false } },
      ];
    }
  }

  // Build sort
  const sortOrder = sort_order === "asc" ? 1 : -1;
  let sort = {};
  switch (sort_by) {
    case "code":
      sort = { code: sortOrder };
      break;
    case "discount_value":
      sort = { discount_value: sortOrder };
      break;
    case "start_date":
      sort = { start_date: sortOrder };
      break;
    case "end_date":
      sort = { end_date: sortOrder };
      break;
    case "createdAt":
    default:
      sort = { createdAt: sortOrder };
  }

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  const [coupons, total] = await Promise.all([
    Coupon.find(query).sort(sort).limit(limitNum).skip(skip).lean(),
    Coupon.countDocuments(query),
  ]);

  // Add computed status based on expiration
  const now = new Date();
  const couponsWithComputedStatus = coupons.map((coupon) => {
    const isExpired = coupon.end_date && new Date(coupon.end_date) < now;
    return {
      ...coupon,
      is_expired: isExpired,
      computed_status: isExpired ? "expired" : coupon.status,
    };
  });

  return {
    coupons: couponsWithComputedStatus,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  };
};

/**
 * Get coupon by ID
 * @param {String} couponId - Coupon ID
 * @returns {Object} - Coupon details
 */
exports.getCouponById = async (couponId) => {
  const coupon = await Coupon.findById(couponId).lean();
  return coupon;
};

/**
 * Create new coupon
 * @param {Object} couponData - Coupon data
 * @returns {Object} - Created coupon
 */
exports.createCoupon = async (couponData) => {
  const {
    code,
    description,
    discount_type,
    discount_value,
    min_order_value,
    max_discount_amount,
    start_date,
    end_date,
    quantity_limit,
    points_required,
    status,
  } = couponData;

  // Validate required fields
  if (!code) {
    throw new Error("Mã coupon là bắt buộc");
  }

  if (!discount_type) {
    throw new Error("Loại giảm giá là bắt buộc");
  }

  if (!["percent", "fixed_amount"].includes(discount_type)) {
    throw new Error(
      "Loại giảm giá không hợp lệ. Chỉ chấp nhận: percent, fixed_amount",
    );
  }

  if (discount_value === undefined || discount_value < 0) {
    throw new Error("Giá trị giảm giá phải lớn hơn hoặc bằng 0");
  }

  // Check for duplicate code
  const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
  if (existingCoupon) {
    throw new Error("Mã coupon đã tồn tại");
  }

  // Validate percent discount
  if (discount_type === "percent" && discount_value > 100) {
    throw new Error("Phần trăm giảm giá không thể lớn hơn 100%");
  }

  // Validate dates
  if (start_date && end_date && new Date(start_date) > new Date(end_date)) {
    throw new Error("Ngày bắt đầu phải trước ngày kết thúc");
  }

  const coupon = await Coupon.create({
    code: code.toUpperCase(),
    description,
    discount_type,
    discount_value,
    min_order_value: min_order_value || 0,
    max_discount_amount: max_discount_amount || 0,
    start_date,
    end_date,
    quantity_limit,
    points_required: points_required || 0,
    status: status || "active",
  });

  return coupon;
};

/**
 * Update coupon
 * @param {String} couponId - Coupon ID
 * @param {Object} updateData - Update data
 * @returns {Object} - Updated coupon
 */
exports.updateCoupon = async (couponId, updateData) => {
  const coupon = await Coupon.findById(couponId);

  if (!coupon) {
    throw new Error("Không tìm thấy coupon");
  }

  const {
    code,
    description,
    discount_type,
    discount_value,
    min_order_value,
    max_discount_amount,
    start_date,
    end_date,
    quantity_limit,
    points_required,
    status,
  } = updateData;

  // Check for duplicate code if changing code
  if (code && code.toUpperCase() !== coupon.code) {
    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (existingCoupon) {
      throw new Error("Mã coupon đã tồn tại");
    }
    coupon.code = code.toUpperCase();
  }

  // Validate discount_type if provided
  if (discount_type) {
    if (!["percent", "fixed_amount"].includes(discount_type)) {
      throw new Error(
        "Loại giảm giá không hợp lệ. Chỉ chấp nhận: percent, fixed_amount",
      );
    }
    coupon.discount_type = discount_type;
  }

  // Validate discount_value
  if (discount_value !== undefined) {
    if (discount_value < 0) {
      throw new Error("Giá trị giảm giá phải lớn hơn hoặc bằng 0");
    }
    const currentDiscountType = discount_type || coupon.discount_type;
    if (currentDiscountType === "percent" && discount_value > 100) {
      throw new Error("Phần trăm giảm giá không thể lớn hơn 100%");
    }
    coupon.discount_value = discount_value;
  }

  // Validate dates
  const newStartDate = start_date ? new Date(start_date) : coupon.start_date;
  const newEndDate = end_date ? new Date(end_date) : coupon.end_date;
  if (newStartDate && newEndDate && newStartDate > newEndDate) {
    throw new Error("Ngày bắt đầu phải trước ngày kết thúc");
  }

  // Update other fields
  if (description !== undefined) coupon.description = description;
  if (min_order_value !== undefined) coupon.min_order_value = min_order_value;
  if (max_discount_amount !== undefined)
    coupon.max_discount_amount = max_discount_amount;
  if (start_date !== undefined) coupon.start_date = start_date;
  if (end_date !== undefined) coupon.end_date = end_date;
  if (quantity_limit !== undefined) coupon.quantity_limit = quantity_limit;
  if (points_required !== undefined) coupon.points_required = points_required;
  if (status !== undefined) {
    if (!["active", "disabled"].includes(status)) {
      throw new Error(
        "Trạng thái không hợp lệ. Chỉ chấp nhận: active, disabled",
      );
    }
    coupon.status = status;
  }

  await coupon.save();

  return coupon;
};

/**
 * Delete coupon (soft delete - change status to disabled)
 * @param {String} couponId - Coupon ID
 * @returns {Object} - Disabled coupon
 */
exports.deleteCoupon = async (couponId) => {
  const coupon = await Coupon.findById(couponId);

  if (!coupon) {
    throw new Error("Không tìm thấy coupon");
  }

  // Soft delete - change status to disabled
  coupon.status = "disabled";
  await coupon.save();

  return coupon;
};

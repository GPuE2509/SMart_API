const Order = require("../../models/Order");

const parseDateOnly = (value, isEndOfDay = false) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const parts = trimmed.split("-");
  if (parts.length !== 3) return null;

  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!year || !month || !day) return null;

  if (isEndOfDay) {
    return new Date(year, month - 1, day, 23, 59, 59, 999);
  }

  return new Date(year, month - 1, day, 0, 0, 0, 0);
};

/**
 * Get all customer orders for admin view.
 * Supports simple pagination and sorting by creation date.
 */
exports.getAllOrders = async (query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || 10));
  const skip = (page - 1) * limit;
  const search = typeof query.search === "string" ? query.search.trim() : "";
  const status =
    typeof query.order_status === "string" ? query.order_status.trim() : "";
  const startDate = parseDateOnly(query.start_date, false);
  const endDate = parseDateOnly(query.end_date, true);

  const matchStage = {};

  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const searchConditions = [
      { order_code: { $regex: escaped, $options: "i" } },
      { "user.full_name": { $regex: escaped, $options: "i" } },
      { "user.email": { $regex: escaped, $options: "i" } },
      { "user.phone": { $regex: escaped, $options: "i" } },
      { "seller.full_name": { $regex: escaped, $options: "i" } },
      { "seller.username": { $regex: escaped, $options: "i" } },
      {
        $expr: {
          $regexMatch: {
            input: { $toString: "$_id" },
            regex: escaped,
            options: "i",
          },
        },
      },
      {
        $expr: {
          $regexMatch: {
            input: { $toString: { $ifNull: ["$final_amount", ""] } },
            regex: escaped,
            options: "i",
          },
        },
      },
      {
        $expr: {
          $regexMatch: {
            input: { $toString: { $ifNull: ["$total_amount", ""] } },
            regex: escaped,
            options: "i",
          },
        },
      },
      {
        $expr: {
          $regexMatch: {
            input: { $toString: { $ifNull: ["$payos_order_code", ""] } },
            regex: escaped,
            options: "i",
          },
        },
      },
    ];
    matchStage.$or = searchConditions;
  }

  if (status) {
    const orderStatuses = [
      "pending",
      "processing",
      "completed",
      "cancelled",
      "returned",
    ];
    const paymentStatuses = ["unpaid", "paid", "refunded"];

    if (orderStatuses.includes(status)) {
      matchStage.order_status = status;
    } else if (paymentStatuses.includes(status)) {
      matchStage.payment_status = status;
    }
  }

  if (startDate || endDate) {
    matchStage.created_at = {};
    if (startDate && !Number.isNaN(startDate.getTime())) {
      matchStage.created_at.$gte = startDate;
    }
    if (endDate && !Number.isNaN(endDate.getTime())) {
      matchStage.created_at.$lte = endDate;
    }
  }

  const result = await Order.aggregate([
    {
      $lookup: {
        from: "users",
        localField: "user_id",
        foreignField: "_id",
        as: "user",
      },
    },
    {
      $unwind: {
        path: "$user",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "staff_id",
        foreignField: "_id",
        as: "seller",
      },
    },
    {
      $unwind: {
        path: "$seller",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $match: matchStage,
    },
    { $sort: { created_at: -1 } },
    {
      $facet: {
        data: [{ $skip: skip }, { $limit: limit }],
        totalCount: [{ $count: "total" }],
      },
    },
  ]);

  const orders = result[0]?.data || [];
  const total = result[0]?.totalCount?.[0]?.total || 0;

  return {
    orders,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Manually confirm payment for an order.
 * Allowed transition: payment_status "unpaid" -> "paid".
 */
exports.confirmOrderPayment = async (orderId) => {
  const order = await Order.findById(orderId);

  if (!order) {
    throw new Error("Không tìm thấy đơn hàng");
  }

  if (order.payment_status !== "unpaid") {
    throw new Error("Chỉ có thể xác nhận thanh toán cho đơn chưa thanh toán");
  }

  order.payment_status = "paid";
  await order.save();

  return order;
};

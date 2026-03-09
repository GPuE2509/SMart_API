const Order = require("../../models/Order");
const OrderDetail = require("../../models/OrderDetail");
const Product = require("../../models/Product");
const ProductUnit = require("../../models/ProductUnit");
const InventoryLog = require("../../models/InventoryLog");
const ProductBatch = require("../../models/ProductBatch");
const mongoose = require("mongoose");

/**
 * Get Revenue & Profit Chart data over time
 * @param {Object} filters - { period: 'day'|'week'|'month', start_date, end_date }
 * @returns {Array} Chart data with revenue and profit by period
 */
exports.getRevenueAndProfitChart = async (filters) => {
  const { period = "day", start_date, end_date } = filters;

  // Default date range: last 30 days
  const endDate = end_date ? new Date(end_date) : new Date();
  const startDate = start_date
    ? new Date(start_date)
    : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Set end date to end of day
  endDate.setHours(23, 59, 59, 999);
  startDate.setHours(0, 0, 0, 0);

  // Build date grouping based on period
  let dateFormat;
  let groupBy;

  switch (period) {
    case "week":
      groupBy = {
        year: { $year: "$created_at" },
        week: { $week: "$created_at" },
      };
      dateFormat = "week";
      break;
    case "month":
      groupBy = {
        year: { $year: "$created_at" },
        month: { $month: "$created_at" },
      };
      dateFormat = "month";
      break;
    case "day":
    default:
      groupBy = {
        year: { $year: "$created_at" },
        month: { $month: "$created_at" },
        day: { $dayOfMonth: "$created_at" },
      };
      dateFormat = "day";
      break;
  }

  const result = await Order.aggregate([
    {
      $match: {
        created_at: { $gte: startDate, $lte: endDate },
        order_status: { $in: ["completed", "processing"] },
        payment_status: "paid",
      },
    },
    {
      $group: {
        _id: groupBy,
        total_revenue: { $sum: "$final_amount" },
        total_orders: { $sum: 1 },
        total_discount: { $sum: "$discount_amount" },
        total_tax: { $sum: "$tax_amount" },
      },
    },
    {
      $project: {
        _id: 0,
        period: "$_id",
        revenue: "$total_revenue",
        // Estimate profit as revenue minus tax (simplified calculation)
        // In real scenario, you'd subtract cost of goods sold (COGS)
        profit: { $subtract: ["$total_revenue", "$total_tax"] },
        total_orders: 1,
        total_discount: 1,
      },
    },
    {
      $sort: {
        "period.year": 1,
        "period.month": 1,
        "period.week": 1,
        "period.day": 1,
      },
    },
  ]);

  // Format the result for charting
  const formattedResult = result.map((item) => {
    let label;
    const p = item.period;

    if (dateFormat === "day") {
      label = `${p.day}/${p.month}/${p.year}`;
    } else if (dateFormat === "week") {
      label = `Tuần ${p.week}/${p.year}`;
    } else {
      label = `${p.month}/${p.year}`;
    }

    return {
      label,
      revenue: item.revenue,
      profit: item.profit,
      total_orders: item.total_orders,
      total_discount: item.total_discount,
    };
  });

  return {
    period: dateFormat,
    start_date: startDate,
    end_date: endDate,
    data: formattedResult,
    summary: {
      total_revenue: formattedResult.reduce(
        (sum, item) => sum + item.revenue,
        0,
      ),
      total_profit: formattedResult.reduce((sum, item) => sum + item.profit, 0),
      total_orders: formattedResult.reduce(
        (sum, item) => sum + item.total_orders,
        0,
      ),
    },
  };
};

/**
 * Get Top Selling Products (Best Sellers)
 * @param {Object} filters - { limit, start_date, end_date }
 * @returns {Array} Top products by revenue
 */
exports.getTopSellingProducts = async (filters) => {
  const { limit = 10, start_date, end_date } = filters;

  // Default date range: last 30 days
  const endDate = end_date ? new Date(end_date) : new Date();
  const startDate = start_date
    ? new Date(start_date)
    : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

  endDate.setHours(23, 59, 59, 999);
  startDate.setHours(0, 0, 0, 0);

  // Get completed orders in date range
  const orders = await Order.find({
    created_at: { $gte: startDate, $lte: endDate },
    order_status: { $in: ["completed", "processing"] },
    payment_status: "paid",
  }).select("_id");

  const orderIds = orders.map((o) => o._id);

  // Aggregate order details by product
  const result = await OrderDetail.aggregate([
    {
      $match: {
        order_id: { $in: orderIds },
      },
    },
    {
      $lookup: {
        from: "productunits",
        localField: "product_unit_id",
        foreignField: "_id",
        as: "product_unit",
      },
    },
    {
      $unwind: "$product_unit",
    },
    {
      $group: {
        _id: "$product_unit.product_id",
        total_quantity: { $sum: "$quantity" },
        total_revenue: { $sum: "$total_price" },
        total_orders: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "product",
      },
    },
    {
      $unwind: "$product",
    },
    {
      $lookup: {
        from: "categories",
        localField: "product.category_id",
        foreignField: "_id",
        as: "category",
      },
    },
    {
      $unwind: { path: "$category", preserveNullAndEmptyArrays: true },
    },
    {
      $project: {
        _id: 0,
        product_id: "$_id",
        product_name: "$product.name",
        product_image: "$product.image_url",
        category_name: "$category.name",
        total_quantity: 1,
        total_revenue: 1,
        total_orders: 1,
      },
    },
    {
      $sort: { total_revenue: -1 },
    },
    {
      $limit: parseInt(limit),
    },
  ]);

  return {
    start_date: startDate,
    end_date: endDate,
    limit: parseInt(limit),
    data: result,
  };
};

/**
 * Get Peak Hours Heatmap data
 * @param {Object} filters - { start_date, end_date }
 * @returns {Array} Heatmap data by day of week and hour
 */
exports.getPeakHoursHeatmap = async (filters) => {
  const { start_date, end_date } = filters;

  // Default date range: last 30 days
  const endDate = end_date ? new Date(end_date) : new Date();
  const startDate = start_date
    ? new Date(start_date)
    : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

  endDate.setHours(23, 59, 59, 999);
  startDate.setHours(0, 0, 0, 0);

  const result = await Order.aggregate([
    {
      $match: {
        created_at: { $gte: startDate, $lte: endDate },
        order_status: { $in: ["completed", "processing"] },
      },
    },
    {
      $group: {
        _id: {
          dayOfWeek: { $dayOfWeek: "$created_at" }, // 1 = Sunday, 7 = Saturday
          hour: { $hour: "$created_at" },
        },
        order_count: { $sum: 1 },
        total_revenue: { $sum: "$final_amount" },
      },
    },
    {
      $project: {
        _id: 0,
        day_of_week: "$_id.dayOfWeek",
        hour: "$_id.hour",
        order_count: 1,
        total_revenue: 1,
      },
    },
    {
      $sort: { day_of_week: 1, hour: 1 },
    },
  ]);

  // Day names mapping (Vietnamese)
  const dayNames = {
    1: "Chủ nhật",
    2: "Thứ 2",
    3: "Thứ 3",
    4: "Thứ 4",
    5: "Thứ 5",
    6: "Thứ 6",
    7: "Thứ 7",
  };

  // Initialize heatmap matrix (7 days x 24 hours)
  const heatmapMatrix = [];
  for (let day = 1; day <= 7; day++) {
    const dayData = {
      day_of_week: day,
      day_name: dayNames[day],
      hours: [],
    };
    for (let hour = 0; hour < 24; hour++) {
      const found = result.find(
        (r) => r.day_of_week === day && r.hour === hour,
      );
      dayData.hours.push({
        hour,
        order_count: found ? found.order_count : 0,
        total_revenue: found ? found.total_revenue : 0,
      });
    }
    heatmapMatrix.push(dayData);
  }

  // Find peak hours (top 5 busiest hours overall)
  const allHours = result.sort((a, b) => b.order_count - a.order_count);
  const peakHours = allHours.slice(0, 5).map((h) => ({
    day: dayNames[h.day_of_week],
    hour: `${h.hour}:00 - ${h.hour + 1}:00`,
    order_count: h.order_count,
    total_revenue: h.total_revenue,
  }));

  return {
    start_date: startDate,
    end_date: endDate,
    heatmap: heatmapMatrix,
    peak_hours: peakHours,
    summary: {
      total_orders: result.reduce((sum, r) => sum + r.order_count, 0),
      busiest_day:
        dayNames[
          result.reduce(
            (max, r) =>
              r.order_count > max.count
                ? { day: r.day_of_week, count: r.order_count }
                : max,
            { day: 1, count: 0 },
          ).day
        ],
    },
  };
};

/**
 * Get overall sales summary
 * @param {Object} filters - { start_date, end_date }
 * @returns {Object} Summary statistics
 */
exports.getSalesSummary = async (filters) => {
  const { start_date, end_date } = filters;

  const endDate = end_date ? new Date(end_date) : new Date();
  const startDate = start_date
    ? new Date(start_date)
    : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

  endDate.setHours(23, 59, 59, 999);
  startDate.setHours(0, 0, 0, 0);

  const [summary] = await Order.aggregate([
    {
      $match: {
        created_at: { $gte: startDate, $lte: endDate },
        order_status: { $in: ["completed", "processing"] },
        payment_status: "paid",
      },
    },
    {
      $group: {
        _id: null,
        total_revenue: { $sum: "$final_amount" },
        total_orders: { $sum: 1 },
        total_discount: { $sum: "$discount_amount" },
        total_tax: { $sum: "$tax_amount" },
        avg_order_value: { $avg: "$final_amount" },
      },
    },
  ]);

  // Get order type breakdown
  const orderTypeBreakdown = await Order.aggregate([
    {
      $match: {
        created_at: { $gte: startDate, $lte: endDate },
        order_status: { $in: ["completed", "processing"] },
        payment_status: "paid",
      },
    },
    {
      $group: {
        _id: "$order_type",
        count: { $sum: 1 },
        revenue: { $sum: "$final_amount" },
      },
    },
  ]);

  // Get payment method breakdown
  const paymentMethodBreakdown = await Order.aggregate([
    {
      $match: {
        created_at: { $gte: startDate, $lte: endDate },
        order_status: { $in: ["completed", "processing"] },
        payment_status: "paid",
      },
    },
    {
      $group: {
        _id: "$payment_method",
        count: { $sum: 1 },
        revenue: { $sum: "$final_amount" },
      },
    },
  ]);

  return {
    start_date: startDate,
    end_date: endDate,
    summary: summary || {
      total_revenue: 0,
      total_orders: 0,
      total_discount: 0,
      total_tax: 0,
      avg_order_value: 0,
    },
    order_type_breakdown: orderTypeBreakdown,
    payment_method_breakdown: paymentMethodBreakdown,
  };
};

/**
 * Get Rescue Efficiency Report (theo mô tả chức năng)
 *
 * 1. Recovered revenue: amount earned from selling discounted goods (Salvage Value)
 *    = Tổng doanh thu từ OrderDetail có is_rescue_pricing = true (đơn đã thanh toán, completed/processing).
 *
 * 2. Loss of cost: Cost of goods that were destroyed.
 *    = Tổng chi phí (số lượng × giá nhập) từ InventoryLog reason_type: expired_disposal, damaged, batch_rejection.
 *
 * 3. Successful rescue rate: (Quantity sold at discounted price / Total quantity nearing expiry) * 100%
 *    - Quantity sold at discounted price = tổng quantity OrderDetail (rescue) trong kỳ.
 *    - Total quantity nearing expiry (trong kỳ) = quantity sold at discount + quantity destroyed
 *      (lượng gần hết hạn đã có kết quả: bán giảm giá hoặc hủy).
 *
 * @param {Object} filters - { start_date, end_date }
 * @returns {Object} recovered_revenue, loss_of_cost, quantity_sold_at_discount, quantity_destroyed, total_quantity_nearing_expiry, successful_rescue_rate
 */
exports.getRescueEfficiencyReport = async (filters) => {
  const { start_date, end_date } = filters;

  const endDate = end_date ? new Date(end_date) : new Date();
  const startDate = start_date
    ? new Date(start_date)
    : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

  endDate.setHours(23, 59, 59, 999);
  startDate.setHours(0, 0, 0, 0);

  // 1) Recovered revenue & quantity sold at discounted price (from OrderDetail where is_rescue_pricing)
  const completedOrderIds = await Order.find({
    created_at: { $gte: startDate, $lte: endDate },
    order_status: { $in: ["completed", "processing"] },
    payment_status: "paid",
  })
    .select("_id")
    .lean();

  const orderIds = completedOrderIds.map((o) => o._id);

  const rescueSales = await OrderDetail.aggregate([
    { $match: { order_id: { $in: orderIds }, is_rescue_pricing: true } },
    {
      $group: {
        _id: null,
        recovered_revenue: { $sum: "$total_price" },
        quantity_sold_at_discount: { $sum: "$quantity" },
      },
    },
  ]);

  const recoveredRevenue = rescueSales[0]?.recovered_revenue ?? 0;
  const quantitySoldAtDiscount = rescueSales[0]?.quantity_sold_at_discount ?? 0;

  // 2) Loss of cost & quantity destroyed (from InventoryLog: expired_disposal, damaged, batch_rejection)
  const disposalLogs = await InventoryLog.find({
    created_at: { $gte: startDate, $lte: endDate },
    reason_type: { $in: ["expired_disposal", "damaged", "batch_rejection"] },
  })
    .select("product_batch_id batch_item_id quantity_change")
    .lean();

  let lossOfCost = 0;
  let quantityDestroyed = 0;

  for (const log of disposalLogs) {
    const qty = Math.abs(log.quantity_change);
    quantityDestroyed += qty;

    const batch = await ProductBatch.findById(log.product_batch_id).lean();
    if (!batch || !batch.items) continue;

    const item = batch.items.find(
      (i) => i._id && i._id.toString() === (log.batch_item_id || "").toString(),
    );
    const importPrice = item?.import_price ?? 0;
    lossOfCost += qty * importPrice;
  }

  // 3) Successful rescue rate: (quantity_sold_at_discount / total_nearing_expiry) * 100
  const totalNearingExpiry = quantitySoldAtDiscount + quantityDestroyed;
  const successfulRescueRate =
    totalNearingExpiry > 0
      ? Math.round((quantitySoldAtDiscount / totalNearingExpiry) * 1000) / 10
      : 0;

  return {
    start_date: startDate,
    end_date: endDate,
    recovered_revenue: recoveredRevenue,
    loss_of_cost: lossOfCost,
    quantity_sold_at_discount: quantitySoldAtDiscount,
    quantity_destroyed: quantityDestroyed,
    total_quantity_nearing_expiry: totalNearingExpiry,
    successful_rescue_rate: successfulRescueRate,
  };
};

const Order = require("../../models/Order");
const OrderDetail = require("../../models/OrderDetail");
const InventoryLog = require("../../models/InventoryLog");
const ProductBatch = require("../../models/ProductBatch");
const ReturnOrder = require("../../models/ReturnOrder");

/**
 * ISO week number (matches MongoDB $week)
 */
function getISOWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay() || 7;
  const thursday = new Date(d);
  thursday.setDate(d.getDate() - day + 4);
  const firstThursday = new Date(thursday.getFullYear(), 0, 1);
  while (firstThursday.getDay() !== 4) {
    firstThursday.setDate(firstThursday.getDate() + 1);
  }
  const weekNum =
    1 + Math.round((thursday - firstThursday) / (7 * 24 * 60 * 60 * 1000));
  return { year: thursday.getFullYear(), week: weekNum };
}

/**
 * Get date group key for period (day/week/month)
 */
function getPeriodGroup(period, date) {
  const d = new Date(date);
  if (period === "month") {
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: null, week: null };
  }
  if (period === "week") {
    const { year, week } = getISOWeek(date);
    return { year, week, month: null, day: null };
  }
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    week: null,
  };
}

function periodToLabel(period, p) {
  if (period === "day" && p.day != null) return `${p.day}/${p.month}/${p.year}`;
  if (period === "week" && p.week != null) return `Tuần ${p.week}/${p.year}`;
  if (p.month) return `${p.month}/${p.year}`;
  return `${p.week}/${p.year}`;
}

/** Normalized key for period map (same for aggregation _id and getPeriodGroup) */
function periodKey(period, p) {
  if (period === "day") return `${p.year}-${p.month}-${p.day}`;
  if (period === "week") return `${p.year}-W${p.week}`;
  return `${p.year}-${p.month}`;
}

/**
 * After-tax report: total business revenue after deductions.
 * Net revenue = gross revenue - discounts - returns - taxes.
 * Taxes include:
 * - personal income tax
 * - small business tax
 * - corporate tax
 * - special excise tax (e.g., alcohol/electronics)
 *
 * @param {Object} filters - { start_date, end_date }
 * @returns {Object} report payload with deduction/tax breakdown
 */
exports.getAfterTaxRevenueReport = async (filters) => {
  const {
    start_date,
    end_date,
    personal_income_tax_rate,
    small_business_tax_rate,
    corporate_tax_rate,
    special_excise_tax_rate,
  } = filters;

  const endDate = end_date ? new Date(end_date) : new Date();
  const startDate = start_date
    ? new Date(start_date)
    : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

  endDate.setHours(23, 59, 59, 999);
  startDate.setHours(0, 0, 0, 0);

  const orderMatch = {
    created_at: { $gte: startDate, $lte: endDate },
    order_status: { $in: ["completed", "processing"] },
    payment_status: "paid",
  };

  const [orderSummary] = await Order.aggregate([
    { $match: orderMatch },
    {
      $group: {
        _id: null,
        gross_revenue: { $sum: "$total_amount" },
        total_discount: { $sum: "$discount_amount" },
        total_orders: { $sum: 1 },
      },
    },
  ]);

  const completedOrders = await Order.find(orderMatch).select("_id").lean();
  const orderIds = completedOrders.map((o) => o._id);

  const [returnsSummary] = await ReturnOrder.aggregate([
    {
      $match: {
        created_at: { $gte: startDate, $lte: endDate },
        order_id: { $in: orderIds },
      },
    },
    {
      $group: {
        _id: null,
        total_returns: { $sum: "$refund_amount" },
      },
    },
  ]);

  const grossRevenue = orderSummary?.gross_revenue || 0;
  const totalDiscount = orderSummary?.total_discount || 0;
  const totalReturns = returnsSummary?.total_returns || 0;

  const taxableRevenue = Math.max(grossRevenue - totalDiscount - totalReturns, 0);

  // Tax rates are configurable by env, with safe defaults.
  const toValidRate = (input, fallback) => {
    const n = Number(input);
    if (Number.isNaN(n) || n < 0) return fallback;
    return n;
  };

  const personalIncomeTaxRate = toValidRate(
    personal_income_tax_rate,
    Number(process.env.PERSONAL_INCOME_TAX_RATE || 0.05),
  );
  const smallBusinessTaxRate = toValidRate(
    small_business_tax_rate,
    Number(process.env.SMALL_BUSINESS_TAX_RATE || 0.03),
  );
  const corporateTaxRate = toValidRate(
    corporate_tax_rate,
    Number(process.env.CORPORATE_TAX_RATE || 0.2),
  );
  const specialExciseTaxRate = toValidRate(
    special_excise_tax_rate,
    Number(process.env.SPECIAL_EXCISE_TAX_RATE || 0.1),
  );

  const taxes = {
    personal_income_tax: Math.round(taxableRevenue * personalIncomeTaxRate),
    small_business_tax: Math.round(taxableRevenue * smallBusinessTaxRate),
    corporate_tax: Math.round(taxableRevenue * corporateTaxRate),
    special_excise_tax: Math.round(taxableRevenue * specialExciseTaxRate),
  };
  const totalTax =
    taxes.personal_income_tax +
    taxes.small_business_tax +
    taxes.corporate_tax +
    taxes.special_excise_tax;

  const netRevenue = Math.max(taxableRevenue - totalTax, 0);

  return {
    start_date: startDate,
    end_date: endDate,
    summary: {
      gross_revenue: grossRevenue,
      total_discount: totalDiscount,
      total_returns: totalReturns,
      taxable_revenue: taxableRevenue,
      total_tax: totalTax,
      net_revenue: netRevenue,
      total_orders: orderSummary?.total_orders || 0,
      description:
        "Shows net revenue minus discounts, returns, and taxes.",
    },
    tax_breakdown: taxes,
    tax_rates: {
      personal_income_tax_rate: personalIncomeTaxRate,
      small_business_tax_rate: smallBusinessTaxRate,
      corporate_tax_rate: corporateTaxRate,
      special_excise_tax_rate: specialExciseTaxRate,
    },
  };
};

/**
 * Cash Flow Chart: track cash inflows (sales) and cash outflows (inventory, operations).
 * - Inflow: revenue from paid orders (completed/processing).
 * - Outflow inventory: cost of goods when importing (InventoryLog reason_type = 'import').
 * - Outflow operations: loss from disposal (expired_disposal, damaged, batch_rejection).
 *
 * @param {Object} filters - { period: 'day'|'week'|'month', start_date, end_date }
 * @returns {Object} { data: [{ label, inflow, outflow_inventory, outflow_operations, outflow_total }], summary }
 */
exports.getCashFlowChart = async (filters) => {
  const { period = "day", start_date, end_date } = filters;

  const endDate = end_date ? new Date(end_date) : new Date();
  const startDate = start_date
    ? new Date(start_date)
    : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

  endDate.setHours(23, 59, 59, 999);
  startDate.setHours(0, 0, 0, 0);

  // --- Inflows: sales by period ---
  let dateGroup;
  switch (period) {
    case "week":
      dateGroup = {
        year: { $year: "$created_at" },
        week: { $week: "$created_at" },
      };
      break;
    case "month":
      dateGroup = {
        year: { $year: "$created_at" },
        month: { $month: "$created_at" },
      };
      break;
    default:
      dateGroup = {
        year: { $year: "$created_at" },
        month: { $month: "$created_at" },
        day: { $dayOfMonth: "$created_at" },
      };
  }

  const inflowAgg = await Order.aggregate([
    {
      $match: {
        created_at: { $gte: startDate, $lte: endDate },
        order_status: { $in: ["completed", "processing"] },
        payment_status: "paid",
      },
    },
    {
      $group: {
        _id: dateGroup,
        inflow: { $sum: "$final_amount" },
      },
    },
  ]);

  // --- Outflows: from InventoryLog (import = purchase cost; disposal = loss) ---
  const outflowLogs = await InventoryLog.find({
    created_at: { $gte: startDate, $lte: endDate },
    reason_type: {
      $in: ["import", "expired_disposal", "damaged", "batch_rejection"],
    },
  })
    .select("created_at reason_type product_batch_id batch_item_id quantity_change")
    .lean();

  const outflowByPeriod = {};
  for (const log of outflowLogs) {
    const batch = await ProductBatch.findById(log.product_batch_id).lean();
    if (!batch || !batch.items) continue;

    const item = batch.items.find(
      (i) => i._id && i._id.toString() === (log.batch_item_id || "").toString()
    );
    const importPrice = item?.import_price ?? 0;
    const qty = Math.abs(log.quantity_change);
    const amount = qty * importPrice;

    const p = getPeriodGroup(period, log.created_at);
    const key = periodKey(period, p);
    if (!outflowByPeriod[key]) {
      outflowByPeriod[key] = { period: p, inventory: 0, operations: 0 };
    }
    if (log.reason_type === "import") {
      outflowByPeriod[key].inventory += amount;
    } else {
      outflowByPeriod[key].operations += amount;
    }
  }

  // Merge inflow periods and build data array (use periodKey for consistency)
  const periodMap = {};
  inflowAgg.forEach((item) => {
    const p = item._id;
    const key = periodKey(period, p);
    if (!periodMap[key]) {
      periodMap[key] = {
        label: periodToLabel(period, p),
        inflow: 0,
        outflow_inventory: 0,
        outflow_operations: 0,
      };
    }
    periodMap[key].inflow = item.inflow;
  });
  Object.keys(outflowByPeriod).forEach((key) => {
    const { period: p, inventory, operations } = outflowByPeriod[key];
    const label = periodToLabel(period, p);
    if (!periodMap[key]) {
      periodMap[key] = {
        label,
        inflow: 0,
        outflow_inventory: 0,
        outflow_operations: 0,
      };
    }
    periodMap[key].outflow_inventory = inventory;
    periodMap[key].outflow_operations = operations;
  });

  const sortedKeys = Object.keys(periodMap).sort((a, b) => a.localeCompare(b));

  const data = sortedKeys.map((key) => {
    const row = periodMap[key];
    row.outflow_total = row.outflow_inventory + row.outflow_operations;
    return row;
  });

  const summary = {
    total_inflow: data.reduce((s, d) => s + d.inflow, 0),
    total_outflow_inventory: data.reduce((s, d) => s + d.outflow_inventory, 0),
    total_outflow_operations: data.reduce((s, d) => s + d.outflow_operations, 0),
    total_outflow: data.reduce((s, d) => s + d.outflow_total, 0),
    net_cash_flow: data.reduce((s, d) => s + d.inflow - d.outflow_total, 0),
  };

  return {
    period,
    start_date: startDate,
    end_date: endDate,
    data,
    summary,
  };
};

/**
 * Cost vs Retail Price Trend Chart: track whether gross profit margin is thinning.
 * Multi-line: average cost (from batch import_price) vs average retail (unit_price) over time.
 *
 * @param {Object} filters - { period: 'day'|'week'|'month', start_date, end_date }
 * @returns {Object} { data: [{ label, avg_cost, avg_retail, total_quantity }], summary }
 */
exports.getCostRetailTrendChart = async (filters) => {
  const { period = "day", start_date, end_date } = filters;

  const endDate = end_date ? new Date(end_date) : new Date();
  const startDate = start_date
    ? new Date(start_date)
    : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

  endDate.setHours(23, 59, 59, 999);
  startDate.setHours(0, 0, 0, 0);

  const completedOrders = await Order.find({
    created_at: { $gte: startDate, $lte: endDate },
    order_status: { $in: ["completed", "processing"] },
    payment_status: "paid",
  })
    .select("_id created_at")
    .lean();

  const orderIds = completedOrders.map((o) => o._id);
  const orderDateMap = {};
  completedOrders.forEach((o) => {
    orderDateMap[o._id.toString()] = o.created_at;
  });

  const details = await OrderDetail.find({
    order_id: { $in: orderIds },
    product_batch_id: { $exists: true, $ne: null, $ne: "" },
    batch_item_id: { $exists: true, $ne: null },
  })
    .select("order_id unit_price quantity product_batch_id batch_item_id")
    .lean();

  const batchIds = [...new Set(details.map((d) => d.product_batch_id).filter(Boolean))];
  const batches = await ProductBatch.find({ _id: { $in: batchIds } }).lean();
  const batchMap = {};
  batches.forEach((b) => {
    batchMap[b._id] = b;
  });

  const byPeriod = {};
  for (const det of details) {
    const orderDate = orderDateMap[det.order_id.toString()];
    if (!orderDate) continue;

    const batch = batchMap[det.product_batch_id];
    if (!batch || !batch.items) continue;

    const item = batch.items.find(
      (i) => i._id && i._id.toString() === (det.batch_item_id || "").toString()
    );
    const importPrice = item?.import_price ?? 0;

    const p = getPeriodGroup(period, orderDate);
    const key = periodKey(period, p);
    if (!byPeriod[key]) {
      byPeriod[key] = {
        period: p,
        total_cost: 0,
        total_retail: 0,
        total_quantity: 0,
      };
    }
    const q = det.quantity || 0;
    byPeriod[key].total_cost += importPrice * q;
    byPeriod[key].total_retail += (det.unit_price || 0) * q;
    byPeriod[key].total_quantity += q;
  }

  const sortedKeys = Object.keys(byPeriod).sort((a, b) => a.localeCompare(b));

  const data = sortedKeys.map((key) => {
    const row = byPeriod[key];
    const q = row.total_quantity || 1;
    return {
      label: periodToLabel(period, row.period),
      avg_cost: Math.round((row.total_cost / q) * 100) / 100,
      avg_retail: Math.round((row.total_retail / q) * 100) / 100,
      total_quantity: row.total_quantity,
    };
  });

  const totalQ = data.reduce((s, d) => s + d.total_quantity, 0);
  const totalCost = data.reduce((s, d) => s + d.avg_cost * d.total_quantity, 0);
  const totalRetail = data.reduce((s, d) => s + d.avg_retail * d.total_quantity, 0);

  return {
    period,
    start_date: startDate,
    end_date: endDate,
    data,
    summary: {
      total_quantity: totalQ,
      overall_avg_cost: totalQ ? Math.round((totalCost / totalQ) * 100) / 100 : 0,
      overall_avg_retail: totalQ ? Math.round((totalRetail / totalQ) * 100) / 100 : 0,
    },
  };
};

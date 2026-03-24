const Order = require("../../models/Order");
const OrderDetail = require("../../models/OrderDetail");
const User = require("../../models/User");
const ProductUnit = require("../../models/ProductUnit");
const mongoose = require("mongoose");

class SellerStaffOrderService {
  /**
   * Get all orders with pagination and filtering
   */
  async getOrderList(options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        order_code,
        phone,
        min_amount,
        max_amount,
        start_date,
        end_date,
        order_status,
        payment_status,
        order_type,
        barcode,
        sort_by = "created_at",
        sort_order = "desc",
      } = options;

      const pipeline = [];

      // Base match stage
      const matchStage = {};

      // Filter by order_code
      if (order_code) {
        matchStage.order_code = new RegExp(order_code, "i");
      }

      // Filter by order status
      if (order_status) {
        matchStage.order_status = order_status;
      }

      // Filter by payment status
      if (payment_status) {
        matchStage.payment_status = payment_status;
      }

      // Filter by order type
      if (order_type) {
        matchStage.order_type = order_type;
      }

      // Filter by amount range
      if (min_amount || max_amount) {
        matchStage.final_amount = {};
        if (min_amount) matchStage.final_amount.$gte = parseFloat(min_amount);
        if (max_amount) matchStage.final_amount.$lte = parseFloat(max_amount);
      }

      // Filter by date range
      if (start_date || end_date) {
        matchStage.created_at = {};
        if (start_date) matchStage.created_at.$gte = new Date(start_date);
        if (end_date) {
          const endDate = new Date(end_date);
          endDate.setHours(23, 59, 59, 999);
          matchStage.created_at.$lte = endDate;
        }
      }

      if (Object.keys(matchStage).length > 0) {
        pipeline.push({ $match: matchStage });
      }

      // Lookup customer info
      pipeline.push({
        $lookup: {
          from: "users",
          localField: "user_id",
          foreignField: "_id",
          as: "customer",
        },
      });

      pipeline.push({
        $unwind: {
          path: "$customer",
          preserveNullAndEmptyArrays: true,
        },
      });

      // Filter by customer phone
      if (phone) {
        pipeline.push({
          $match: {
            "customer.phone": new RegExp(phone, "i"),
          },
        });
      }

      // If searching by barcode, need to lookup order details
      if (barcode) {
        // Lookup order details
        pipeline.push({
          $lookup: {
            from: "orderdetails",
            localField: "_id",
            foreignField: "order_id",
            as: "order_details",
          },
        });

        // Unwind order details
        pipeline.push({
          $unwind: {
            path: "$order_details",
            preserveNullAndEmptyArrays: false,
          },
        });

        // Lookup product units to get barcode
        pipeline.push({
          $lookup: {
            from: "productunits",
            localField: "order_details.product_unit_id",
            foreignField: "_id",
            as: "product_unit",
          },
        });

        pipeline.push({
          $unwind: {
            path: "$product_unit",
            preserveNullAndEmptyArrays: false,
          },
        });

        // Match barcode
        pipeline.push({
          $match: {
            "product_unit.barcode": new RegExp(barcode, "i"),
          },
        });

        // Group back to get unique orders
        pipeline.push({
          $group: {
            _id: "$_id",
            order_code: { $first: "$order_code" },
            user_id: { $first: "$user_id" },
            staff_id: { $first: "$staff_id" },
            total_amount: { $first: "$total_amount" },
            discount_amount: { $first: "$discount_amount" },
            final_amount: { $first: "$final_amount" },
            payment_method: { $first: "$payment_method" },
            payment_status: { $first: "$payment_status" },
            order_status: { $first: "$order_status" },
            order_type: { $first: "$order_type" },
            created_at: { $first: "$created_at" },
            customer: { $first: "$customer" },
          },
        });
      }

      // Lookup staff info
      pipeline.push({
        $lookup: {
          from: "users",
          localField: "staff_id",
          foreignField: "_id",
          as: "staff",
        },
      });

      pipeline.push({
        $unwind: {
          path: "$staff",
          preserveNullAndEmptyArrays: true,
        },
      });

      // Facet for pagination
      const sortField = sort_by === "created_at" ? "created_at" : sort_by;
      const sortDirection = sort_order === "asc" ? 1 : -1;

      pipeline.push({
        $facet: {
          metadata: [{ $count: "total" }],
          data: [
            { $sort: { [sortField]: sortDirection } },
            { $skip: (parseInt(page) - 1) * parseInt(limit) },
            { $limit: parseInt(limit) },
            {
              $project: {
                _id: 1,
                order_code: 1,
                total_amount: 1,
                discount_amount: 1,
                final_amount: 1,
                payment_method: 1,
                payment_status: 1,
                order_status: 1,
                order_type: 1,
                created_at: 1,
                customer: {
                  _id: 1,
                  full_name: 1,
                  phone: 1,
                  email: 1,
                },
                staff: {
                  _id: 1,
                  full_name: 1,
                },
              },
            },
          ],
        },
      });

      const result = await Order.aggregate(pipeline);

      const total = result[0]?.metadata[0]?.total || 0;
      const orders = result[0]?.data || [];

      return {
        success: true,
        orders,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get order detail by ID
   */
  async getOrderDetail(orderId) {
    try {
      const order = await Order.findById(orderId)
        .populate("user_id", "full_name phone email address")
        .populate("staff_id", "full_name")
        .populate("coupon_id", "code discount_type discount_value");

      if (!order) {
        throw new Error("Order not found");
      }

      // Get order details with product info
      const orderDetails = await OrderDetail.find({
        order_id: orderId,
      }).populate({
        path: "product_unit_id",
        select: "price barcode",
        populate: [
          { path: "product_id", select: "product_name image_url" },
          { path: "unit_id", select: "unit_name" },
        ],
      });

      return {
        success: true,
        order: {
          ...order.toObject(),
          order_details: orderDetails,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Search orders by barcode (scan product)
   */
  async searchByBarcode(barcode) {
    try {
      // First, find product unit with this barcode
      const productUnit = await ProductUnit.findOne({
        barcode: new RegExp(`^${barcode}$`, "i"),
      });

      if (!productUnit) {
        return {
          success: true,
          orders: [],
          message: "No product found with this barcode",
        };
      }

      // Find orders containing this product
      const orderDetails = await OrderDetail.find({
        product_unit_id: productUnit._id,
      }).select("order_id");

      const orderIds = orderDetails.map((od) => od.order_id);

      const orders = await Order.find({ _id: { $in: orderIds } })
        .populate("user_id", "full_name phone email")
        .populate("staff_id", "full_name")
        .sort({ created_at: -1 })
        .limit(50);

      return {
        success: true,
        orders,
        productUnit: {
          _id: productUnit._id,
          barcode: productUnit.barcode,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get order statistics for seller staff
   */
  async getOrderStats(staffId, startDate, endDate) {
    try {
      const matchStage = {};

      if (staffId) {
        matchStage.staff_id = new mongoose.Types.ObjectId(staffId);
      }

      if (startDate || endDate) {
        matchStage.created_at = {};
        if (startDate) matchStage.created_at.$gte = new Date(startDate);
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          matchStage.created_at.$lte = end;
        }
      }

      const pipeline = [
        { $match: matchStage },
        {
          $group: {
            _id: null,
            total_orders: { $sum: 1 },
            total_amount: { $sum: "$final_amount" },
            pending_orders: {
              $sum: { $cond: [{ $eq: ["$order_status", "pending"] }, 1, 0] },
            },
            processing_orders: {
              $sum: { $cond: [{ $eq: ["$order_status", "processing"] }, 1, 0] },
            },
            completed_orders: {
              $sum: { $cond: [{ $eq: ["$order_status", "completed"] }, 1, 0] },
            },
            cancelled_orders: {
              $sum: { $cond: [{ $eq: ["$order_status", "cancelled"] }, 1, 0] },
            },
          },
        },
      ];

      const result = await Order.aggregate(pipeline);
      const stats = result[0] || {
        total_orders: 0,
        total_amount: 0,
        pending_orders: 0,
        processing_orders: 0,
        completed_orders: 0,
        cancelled_orders: 0,
      };

      return {
        success: true,
        stats,
      };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new SellerStaffOrderService();

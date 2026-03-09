const { User, Coupon, UserCoupon } = require("../../models");

const userCouponService = {
  /**
   * Purchase a coupon using user's loyalty points
   * - Validate coupon status and expiration
   * - Check user loyalty_points balance
   * - Respect coupon quantity_limit if provided
   * - Deduct points and create UserCoupon record
   *
   * @param {string} userId
   * @param {string} couponId
   * @returns {Promise<{ userCoupon: any, user: any }>}
   */
  purchaseCoupon: async (userId, couponId) => {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("Không tìm thấy người dùng");
    }

    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      throw new Error("Không tìm thấy coupon");
    }

    if (coupon.status !== "active") {
      throw new Error("Coupon hiện không hoạt động");
    }

    const now = new Date();
    if (coupon.end_date && new Date(coupon.end_date) < now) {
      throw new Error("Coupon đã hết hạn");
    }

    const requiredPoints = coupon.points_required || 0;
    if (requiredPoints <= 0) {
      throw new Error("Coupon này không thể đổi bằng điểm");
    }

    if (user.loyalty_points < requiredPoints) {
      throw new Error("Điểm tích lũy không đủ để đổi coupon này");
    }

    // Check global quantity limit (across all users)
    if (coupon.quantity_limit !== undefined && coupon.quantity_limit !== null) {
      const issuedCount = await UserCoupon.countDocuments({
        coupon_id: coupon._id,
      });
      if (issuedCount >= coupon.quantity_limit) {
        throw new Error("Coupon đã hết số lượng");
      }
    }

    // Deduct loyalty points and save user
    user.loyalty_points -= requiredPoints;
    await user.save();

    // Create a new user coupon (wallet entry)
    const userCoupon = await UserCoupon.create({
      user_id: user._id,
      coupon_id: coupon._id,
    });

    return {
      userCoupon,
      user,
    };
  },

  /**
   * Get all coupons in a user's wallet
   * @param {string} userId
   * @param {{ is_used?: string | boolean }} filters
   */
  getUserCoupons: async (userId, filters = {}) => {
    const query = {
      user_id: userId,
    };

    const { is_used } = filters;
    if (is_used !== undefined && is_used !== null && is_used !== "") {
      if (is_used === "true" || is_used === true) {
        query.is_used = true;
      } else if (is_used === "false" || is_used === false) {
        query.is_used = false;
      }
    }

    const userCoupons = await UserCoupon.find(query)
      .populate("coupon_id")
      .sort({ createdAt: -1 })
      .lean();

    const now = new Date();
    const enriched = userCoupons.map((uc) => {
      const coupon = uc.coupon_id;
      const isExpired =
        coupon && coupon.end_date ? new Date(coupon.end_date) < now : false;

      return {
        ...uc,
        coupon: coupon,
        is_expired: isExpired,
      };
    });

    return enriched;
  },

  /**
   * Validate and check if a coupon can be applied to an order
   * @param {string} userId
   * @param {string} couponCode
   * @param {number} orderAmount - total order amount before discount
   * @returns {Promise<{ valid: boolean, coupon?: any, userCoupon?: any, discount?: number, message?: string }>}
   */
  validateCoupon: async (userId, couponCode, orderAmount) => {
    // Find coupon by code
    const coupon = await Coupon.findOne({ code: couponCode }).lean();
    
    if (!coupon) {
      return {
        valid: false,
        message: "Mã giảm giá không tồn tại"
      };
    }

    // Check if coupon is active
    if (coupon.status !== "active") {
      return {
        valid: false,
        message: "Mã giảm giá không hoạt động"
      };
    }

    // Check expiration
    const now = new Date();
    if (coupon.start_date && new Date(coupon.start_date) > now) {
      return {
        valid: false,
        message: "Mã giảm giá chưa có hiệu lực"
      };
    }

    if (coupon.end_date && new Date(coupon.end_date) < now) {
      return {
        valid: false,
        message: "Mã giảm giá đã hết hạn"
      };
    }

    // Check minimum order value
    if (coupon.min_order_value && orderAmount < coupon.min_order_value) {
      return {
        valid: false,
        message: `Đơn hàng tối thiểu ${coupon.min_order_value.toLocaleString("vi-VN")}đ để sử dụng mã này`
      };
    }

    // Check if user owns this coupon (if points_required > 0)
    if (coupon.points_required > 0) {
      const userCoupon = await UserCoupon.findOne({
        user_id: userId,
        coupon_id: coupon._id,
        is_used: false
      });

      if (!userCoupon) {
        return {
          valid: false,
          message: "Bạn không sở hữu mã giảm giá này hoặc đã sử dụng"
        };
      }

      // Calculate discount amount
      let discountAmount = 0;
      if (coupon.discount_type === "percent") {
        discountAmount = Math.round((orderAmount * coupon.discount_value) / 100);
        if (coupon.max_discount_amount > 0) {
          discountAmount = Math.min(discountAmount, coupon.max_discount_amount);
        }
      } else {
        discountAmount = coupon.discount_value;
      }

      return {
        valid: true,
        coupon,
        userCoupon,
        discount: discountAmount,
        message: "Mã giảm giá hợp lệ"
      };
    }

    // Public coupon (no points required)
    // Calculate discount amount
    let discountAmount = 0;
    if (coupon.discount_type === "percent") {
      discountAmount = Math.round((orderAmount * coupon.discount_value) / 100);
      if (coupon.max_discount_amount > 0) {
        discountAmount = Math.min(discountAmount, coupon.max_discount_amount);
      }
    } else {
      discountAmount = coupon.discount_value;
    }

    return {
      valid: true,
      coupon,
      discount: discountAmount,
      message: "Mã giảm giá hợp lệ"
    };
  },
};

module.exports = userCouponService;


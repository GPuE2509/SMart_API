const userCouponService = require("../../services/customer/userCouponService");

const userCouponController = {
  /**
   * Purchase a coupon using loyalty points
   * POST /api/v1/customer/user-coupons/purchase
   * Body: { coupon_id }
   */
  purchase: async (req, res) => {
    try {
      const userId = req.user._id;
      const { coupon_id } = req.body;

      if (!coupon_id) {
        return res.status(400).json({
          success: false,
          message: "coupon_id là bắt buộc",
        });
      }

      const result = await userCouponService.purchaseCoupon(userId, coupon_id);

      return res.status(201).json({
        success: true,
        message: "Đổi coupon thành công",
        data: {
          user_coupon: result.userCoupon,
          loyalty_points: result.user.loyalty_points,
        },
      });
    } catch (error) {
      const badRequestMessages = [
        "Coupon hiện không hoạt động",
        "Coupon đã hết hạn",
        "Coupon này không thể đổi bằng điểm",
        "Điểm tích lũy không đủ để đổi coupon này",
        "Coupon đã hết số lượng",
      ];

      if (badRequestMessages.includes(error.message)) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      if (
        error.message === "Không tìm thấy người dùng" ||
        error.message === "Không tìm thấy coupon"
      ) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      console.error("Error purchasing coupon:", error);
      return res.status(500).json({
        success: false,
        message: "Không thể đổi coupon",
        error: error.message,
      });
    }
  },

  /**
   * Get all coupons in current user's wallet
   * GET /api/v1/customer/user-coupons
   * Query: is_used
   */
  getMyCoupons: async (req, res) => {
    try {
      const userId = req.user._id;
      const filters = {
        is_used: req.query.is_used,
      };

      const userCoupons = await userCouponService.getUserCoupons(
        userId,
        filters,
      );

      return res.status(200).json({
        success: true,
        message: "Lấy danh sách voucher trong ví thành công",
        data: userCoupons,
      });
    } catch (error) {
      console.error("Error getting user coupons:", error);
      return res.status(500).json({
        success: false,
        message: "Không thể lấy danh sách voucher",
        error: error.message,
      });
    }
  },

  /**
   * Validate a coupon code for checkout
   * POST /api/v1/customer/user-coupons/validate
   * Body: { coupon_code, order_amount }
   */
  validateCoupon: async (req, res) => {
    try {
      const userId = req.user._id;
      const { coupon_code, order_amount } = req.body;

      if (!coupon_code) {
        return res.status(400).json({
          success: false,
          message: "coupon_code là bắt buộc",
        });
      }

      if (!order_amount || order_amount <= 0) {
        return res.status(400).json({
          success: false,
          message: "order_amount là bắt buộc và phải lớn hơn 0",
        });
      }

      const result = await userCouponService.validateCoupon(
        userId,
        coupon_code,
        order_amount
      );

      if (!result.valid) {
        return res.status(400).json({
          success: false,
          message: result.message,
          data: result,
        });
      }

      return res.status(200).json({
        success: true,
        message: result.message,
        data: {
          coupon: result.coupon,
          discount: result.discount,
          user_coupon_id: result.userCoupon?._id,
        },
      });
    } catch (error) {
      console.error("Error validating coupon:", error);
      return res.status(500).json({
        success: false,
        message: "Không thể kiểm tra mã giảm giá",
        error: error.message,
      });
    }
  },
};

module.exports = userCouponController;


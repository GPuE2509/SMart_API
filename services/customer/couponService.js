const adminCouponService = require("../admin/couponService");

const couponService = {
  /**
   * Get all currently available (valid) coupons for customers
   * - Only coupons with status "active"
   * - And not expired (based on end_date)
   *
   * This reuses the existing admin coupon service logic without modifying it.
   */
  getAvailable: async (filters = {}) => {
    try {
      const {
        page = 1,
        limit = 20,
        sort_by = "createdAt",
        sort_order = "desc",
      } = filters;

      const result = await adminCouponService.getAllCoupons({
        status: "active",
        is_expired: "false",
        sort_by,
        sort_order,
        page,
        limit,
      });

      return {
        success: true,
        data: result.coupons,
        pagination: result.pagination,
      };
    } catch (error) {
      throw error;
    }
  },
};

module.exports = couponService;


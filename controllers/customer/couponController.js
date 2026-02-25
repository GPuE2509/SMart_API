const couponService = require("../../services/customer/couponService");

const couponController = {
  /**
   * Get all currently available coupons for customers
   * GET /api/v1/customer/coupons/available
   */
  getAvailable: async (req, res) => {
    try {
      const filters = {
        page: req.query.page || 1,
        limit: req.query.limit || 20,
        sort_by: req.query.sort_by || "createdAt",
        sort_order: req.query.sort_order || "desc",
      };

      const result = await couponService.getAvailable(filters);
      return res.status(200).json(result);
    } catch (error) {
      console.error("Error getting available coupons:", error);
      return res.status(500).json({
        success: false,
        message: "Error getting available coupons",
        error: error.message,
      });
    }
  },
};

module.exports = couponController;


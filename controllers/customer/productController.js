const productService = require("../../services/customer/productService");

const productController = {
  /**
   * Get all products with filters
   * GET /api/v1/customer/products
   */
  getAll: async (req, res) => {
    try {
      const filters = {
        search: req.query.search,
        category_id: req.query.category_id,
        min_price: req.query.min_price,
        max_price: req.query.max_price,
        sort_by: req.query.sort_by || "createdAt",
        order: req.query.order || "DESC",
        page: req.query.page || 1,
        limit: req.query.limit || 20,
      };

      const result = await productService.getAll(filters);
      return res.status(200).json(result);
    } catch (error) {
      console.error("Error getting products:", error);
      return res.status(500).json({
        success: false,
        message: "Error getting products",
        error: error.message,
      });
    }
  },

  /**
   * Get product by ID
   * GET /api/v1/customer/products/:id
   */
  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const result = await productService.getById(id);

      if (!result.success) {
        return res.status(404).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error("Error getting product:", error);
      return res.status(500).json({
        success: false,
        message: "Error getting product",
        error: error.message,
      });
    }
  },

  /**
   * Get featured products
   * GET /api/v1/customer/products/featured/list
   */
  getFeatured: async (req, res) => {
    try {
      const limit = req.query.limit || 10;
      const result = await productService.getFeatured(limit);
      return res.status(200).json(result);
    } catch (error) {
      console.error("Error getting featured products:", error);
      return res.status(500).json({
        success: false,
        message: "Error getting featured products",
        error: error.message,
      });
    }
  },

  /**
   * Get related products
   * GET /api/v1/customer/products/:id/related
   */
  getRelated: async (req, res) => {
    try {
      const { id } = req.params;
      const limit = req.query.limit || 5;
      const result = await productService.getRelated(id, limit);

      if (!result.success) {
        return res.status(404).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error("Error getting related products:", error);
      return res.status(500).json({
        success: false,
        message: "Error getting related products",
        error: error.message,
      });
    }
  },
};

module.exports = productController;

const categoryService = require("../../services/customer/categoryService");

const categoryController = {
  /**
   * Get all categories
   * GET /api/v1/customer/categories
   */
  getAll: async (req, res) => {
    try {
      const result = await categoryService.getAll();
      return res.status(200).json(result);
    } catch (error) {
      console.error("Error getting categories:", error);
      return res.status(500).json({
        success: false,
        message: "Error getting categories",
        error: error.message,
      });
    }
  },

  /**
   * Get category by ID
   * GET /api/v1/customer/categories/:id
   */
  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const includeProducts = req.query.include_products === "true";

      const result = await categoryService.getById(id, includeProducts);

      if (!result.success) {
        return res.status(404).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error("Error getting category:", error);
      return res.status(500).json({
        success: false,
        message: "Error getting category",
        error: error.message,
      });
    }
  },

  /**
   * Get category tree
   * GET /api/v1/customer/categories/tree/all
   */
  getTree: async (req, res) => {
    try {
      const result = await categoryService.getTree();
      return res.status(200).json(result);
    } catch (error) {
      console.error("Error getting category tree:", error);
      return res.status(500).json({
        success: false,
        message: "Error getting category tree",
        error: error.message,
      });
    }
  },
};

module.exports = categoryController;

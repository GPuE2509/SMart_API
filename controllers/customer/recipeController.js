const recipeService = require("../../services/customer/recipeService");

const recipeController = {
  /**
   * Get all recipes
   * GET /api/v1/customer/recipes
   */
  getAll: async (req, res) => {
    try {
      const filters = {
        search: req.query.search,
        ingredient_names: req.query.ingredient_names,
        sort_by: req.query.sort_by || "createdAt",
        order: req.query.order || "DESC",
        page: req.query.page || 1,
        limit: req.query.limit || 20,
      };

      const result = await recipeService.getAll(filters);
      return res.status(200).json(result);
    } catch (error) {
      console.error("Error getting recipes:", error);
      return res.status(500).json({
        success: false,
        message: "Error getting recipes",
        error: error.message,
      });
    }
  },

  /**
   * Get recipe detail by ID
   * GET /api/v1/customer/recipes/:id
   */
  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const result = await recipeService.getById(id);

      if (!result.success) {
        return res.status(404).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error("Error getting recipe:", error);
      return res.status(500).json({
        success: false,
        message: "Error getting recipe",
        error: error.message,
      });
    }
  },
};

module.exports = recipeController;


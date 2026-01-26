const { Category, Product } = require("../../models");

const categoryService = {
  /**
   * Get all categories with product count
   */
  getAll: async () => {
    try {
      const categories = await Category.find({
        is_active: true,
      })
        .sort({ name: 1 })
        .lean();

      // Get product count for each category
      for (let category of categories) {
        const productCount = await Product.countDocuments({
          category_id: category._id,
          is_active: true,
        });
        category.product_count = productCount;
      }

      return {
        success: true,
        data: categories,
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get category by ID with products
   */
  getById: async (id, includeProducts = false) => {
    try {
      const category = await Category.findOne({
        _id: id,
        is_active: true,
      }).lean();

      if (!category) {
        return {
          success: false,
          message: "Category not found",
        };
      }

      // Include products if requested
      if (includeProducts) {
        const products = await Product.find({
          category_id: id,
          is_active: true,
        })
          .limit(20)
          .lean();

        category.products = products;
      }

      return {
        success: true,
        data: category,
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get category tree structure
   */
  getTree: async () => {
    try {
      // Get all active categories
      const categories = await Category.find({
        is_active: true,
      })
        .sort({ name: 1 })
        .lean();

      // Get product count for each category
      for (let category of categories) {
        const productCount = await Product.countDocuments({
          category_id: category._id,
          is_active: true,
        });
        category.product_count = productCount;
      }

      // Build tree structure
      const buildTree = (parentId = null) => {
        return categories
          .filter((cat) => {
            if (parentId === null) {
              return !cat.parent_id || cat.parent_id === null;
            }
            return (
              cat.parent_id && cat.parent_id.toString() === parentId.toString()
            );
          })
          .map((cat) => ({
            ...cat,
            children: buildTree(cat._id),
          }));
      };

      const tree = buildTree();

      return {
        success: true,
        data: tree,
      };
    } catch (error) {
      throw error;
    }
  },
};

module.exports = categoryService;

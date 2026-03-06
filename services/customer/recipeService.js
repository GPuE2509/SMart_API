const { Recipe, RecipeIngredient, Product } = require("../../models");

const recipeService = {
  /**
   * Get all recipes (for customers)
   * Supports basic search + pagination to match product style.
   */
  getAll: async (filters = {}) => {
    const {
      search,
      ingredient_names,
      sort_by = "createdAt",
      order = "DESC",
      page = 1,
      limit = 20,
    } = filters;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const query = {};

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const rawNames =
      ingredient_names == null
        ? ""
        : Array.isArray(ingredient_names)
          ? ingredient_names.join(",")
          : String(ingredient_names);
    const keywords = rawNames
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (keywords.length > 0) {
      const regexPattern = keywords
        .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|");
      const products = await Product.find({
        name: { $regex: regexPattern, $options: "i" },
      })
        .select("_id")
        .lean();
      const productIds = products.map((p) => p._id);
      const recipeIds =
        productIds.length > 0
          ? await RecipeIngredient.distinct("recipe_id", {
              product_id: { $in: productIds },
            })
          : [];
      query._id = { $in: recipeIds };
    }

    const sortOrder = order === "DESC" ? -1 : 1;
    const total = await Recipe.countDocuments(query);
    const skip = (pageNum - 1) * limitNum;

    const recipes = await Recipe.find(query)
      .sort({ [sort_by]: sortOrder })
      .skip(skip)
      .limit(limitNum)
      .lean();

    return {
      success: true,
      data: {
        recipes,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    };
  },

  /**
   * Get recipe detail with ingredients
   */
  getById: async (id) => {
    const recipe = await Recipe.findById(id).lean();
    if (!recipe) {
      return { success: false, message: "Recipe not found" };
    }

    const ingredients = await RecipeIngredient.find({ recipe_id: id })
      .populate("product_id", "name image_url")
      .lean();

    const mappedIngredients = ingredients.map((ing) => ({
      _id: ing._id,
      product_id: ing.product_id?._id || ing.product_id,
      product_name: ing.product_id?.name || "",
      product_image_url: ing.product_id?.image_url || "",
      quantity_needed: ing.quantity_needed,
      unit_note: ing.unit_note,
    }));

    return {
      success: true,
      data: { ...recipe, ingredients: mappedIngredients },
    };
  },
};

module.exports = recipeService;


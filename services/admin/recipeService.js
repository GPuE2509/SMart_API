const Recipe = require("../../models/Recipe");
const RecipeIngredient = require("../../models/RecipeIngredient");
const Product = require("../../models/Product");
const { uploadImage } = require("../../utils/uploadImage");

/**
 * Remove Vietnamese diacritics for search
 */
const removeVietnameseDiacritics = (str) => {
  if (str === null || str === undefined) return "";
  return String(str)
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]/g,
      "",
    )
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
};

/**
 * Get all recipes with search and pagination
 * @param {Object} filters - { search, page, limit, sort_by }
 */
exports.getAllRecipes = async (filters) => {
  const { search, page = 1, limit = 20, sort_by = "newest" } = filters;

  let query = {};

  // Build sort
  let sort = {};
  switch (sort_by) {
    case "title":
      sort = { title: 1 };
      break;
    case "newest":
      sort = { createdAt: -1 };
      break;
    case "oldest":
      sort = { createdAt: 1 };
      break;
    default:
      sort = { createdAt: -1 };
  }

  // Get all recipes
  let recipes = await Recipe.find(query).sort(sort).lean();

  // Search by title or description
  if (search) {
    const searchNormalized = removeVietnameseDiacritics(search);
    recipes = recipes.filter((r) => {
      const titleNormalized = removeVietnameseDiacritics(r.title);
      const descNormalized = removeVietnameseDiacritics(r.description || "");
      return (
        titleNormalized.includes(searchNormalized) ||
        descNormalized.includes(searchNormalized)
      );
    });
  }

  // Pagination
  const total = recipes.length;
  const totalPages = Math.ceil(total / limit);
  const skip = (page - 1) * limit;
  const paginatedRecipes = recipes.slice(skip, skip + parseInt(limit));

  // Get ingredient count for each recipe
  const recipesWithCount = await Promise.all(
    paginatedRecipes.map(async (recipe) => {
      const ingredientCount = await RecipeIngredient.countDocuments({
        recipe_id: recipe._id,
      });
      return {
        ...recipe,
        ingredient_count: ingredientCount,
      };
    }),
  );

  return {
    recipes: recipesWithCount,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages,
    },
  };
};

/**
 * Get recipe by ID with full details including ingredients
 * @param {String} id - Recipe ID
 */
exports.getRecipeById = async (id) => {
  const recipe = await Recipe.findById(id).lean();

  if (!recipe) {
    return null;
  }

  // Get ingredients with product details
  const ingredients = await RecipeIngredient.find({ recipe_id: id })
    .populate({
      path: "product_id",
      select: "name image_url description",
    })
    .lean();

  return {
    ...recipe,
    ingredients: ingredients.map((ing) => ({
      _id: ing._id,
      product: ing.product_id,
      quantity_needed: ing.quantity_needed,
      unit_note: ing.unit_note,
    })),
  };
};

/**
 * Create new recipe
 * @param {Object} data - { title, description, instruction, image_url, ingredients }
 */
exports.createRecipe = async (data) => {
  const { title, description, instruction, image_url, ingredients } = data;

  if (!title || !title.trim()) {
    throw new Error("Tiêu đề công thức là bắt buộc");
  }

  // Handle image upload if base64 provided
  let finalImageUrl = image_url;
  if (image_url && image_url.startsWith("data:image")) {
    try {
      finalImageUrl = await uploadImage(image_url);
    } catch (error) {
      console.error("Error uploading image:", error);
      finalImageUrl = null;
    }
  }

  // Create recipe
  const recipe = new Recipe({
    title: title.trim(),
    description,
    instruction,
    image_url: finalImageUrl,
  });

  await recipe.save();

  // Add ingredients if provided
  if (ingredients && ingredients.length > 0) {
    const ingredientDocs = ingredients.map((ing) => ({
      recipe_id: recipe._id,
      product_id: ing.product_id,
      quantity_needed: ing.quantity_needed || 0,
      unit_note: ing.unit_note || "",
    }));

    await RecipeIngredient.insertMany(ingredientDocs);
  }

  // Return recipe with ingredients
  return await this.getRecipeById(recipe._id);
};

/**
 * Update recipe
 * @param {String} id - Recipe ID
 * @param {Object} data - Update data
 */
exports.updateRecipe = async (id, data) => {
  const { title, description, instruction, image_url, ingredients, is_active } =
    data;

  const recipe = await Recipe.findById(id);
  if (!recipe) {
    return null;
  }

  // Update fields
  if (title !== undefined) recipe.title = title.trim();
  if (description !== undefined) recipe.description = description;
  if (instruction !== undefined) recipe.instruction = instruction;

  // Handle image upload
  if (image_url !== undefined) {
    if (image_url && image_url.startsWith("data:image")) {
      try {
        recipe.image_url = await uploadImage(image_url);
      } catch (error) {
        console.error("Error uploading image:", error);
      }
    } else {
      recipe.image_url = image_url;
    }
  }

  await recipe.save();

  // Update ingredients if provided
  if (ingredients !== undefined) {
    // Remove existing ingredients
    await RecipeIngredient.deleteMany({ recipe_id: id });

    // Add new ingredients
    if (ingredients && ingredients.length > 0) {
      const ingredientDocs = ingredients.map((ing) => ({
        recipe_id: recipe._id,
        product_id: ing.product_id,
        quantity_needed: ing.quantity_needed || 0,
        unit_note: ing.unit_note || "",
      }));

      await RecipeIngredient.insertMany(ingredientDocs);
    }
  }

  return await this.getRecipeById(id);
};

/**
 * Delete recipe (hard delete)
 * @param {String} id - Recipe ID
 */
exports.deleteRecipe = async (id) => {
  const recipe = await Recipe.findById(id);
  if (!recipe) {
    return null;
  }

  // Delete ingredients first
  await RecipeIngredient.deleteMany({ recipe_id: id });

  // Delete recipe
  await Recipe.findByIdAndDelete(id);

  return { deleted: true };
};

/**
 * Search/filter recipes
 * @param {Object} filters - { search, ingredient_id, min_ingredients, max_ingredients }
 */
exports.searchRecipes = async (filters) => {
  const {
    search,
    ingredient_id,
    min_ingredients,
    max_ingredients,
    page = 1,
    limit = 20,
  } = filters;

  let recipes = await Recipe.find().lean();

  // Search by title or description
  if (search) {
    const searchNormalized = removeVietnameseDiacritics(search);
    recipes = recipes.filter((r) => {
      const titleNormalized = removeVietnameseDiacritics(r.title);
      const descNormalized = removeVietnameseDiacritics(r.description || "");
      const instructionNormalized = removeVietnameseDiacritics(
        r.instruction || "",
      );
      return (
        titleNormalized.includes(searchNormalized) ||
        descNormalized.includes(searchNormalized) ||
        instructionNormalized.includes(searchNormalized)
      );
    });
  }

  // Filter by ingredient
  if (ingredient_id) {
    const recipesWithIngredient = await RecipeIngredient.find({
      product_id: ingredient_id,
    }).distinct("recipe_id");

    recipes = recipes.filter((r) =>
      recipesWithIngredient.some((id) => id.toString() === r._id.toString()),
    );
  }

  // Get ingredient count for each recipe
  const recipesWithCount = await Promise.all(
    recipes.map(async (recipe) => {
      const ingredientCount = await RecipeIngredient.countDocuments({
        recipe_id: recipe._id,
      });
      return {
        ...recipe,
        ingredient_count: ingredientCount,
      };
    }),
  );

  // Filter by ingredient count
  let filteredRecipes = recipesWithCount;
  if (min_ingredients) {
    filteredRecipes = filteredRecipes.filter(
      (r) => r.ingredient_count >= parseInt(min_ingredients),
    );
  }
  if (max_ingredients) {
    filteredRecipes = filteredRecipes.filter(
      (r) => r.ingredient_count <= parseInt(max_ingredients),
    );
  }

  // Pagination
  const total = filteredRecipes.length;
  const totalPages = Math.ceil(total / limit);
  const skip = (page - 1) * limit;
  const paginatedRecipes = filteredRecipes.slice(skip, skip + parseInt(limit));

  return {
    recipes: paginatedRecipes,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages,
    },
  };
};

/**
 * Toggle recipe active status
 * @param {String} id - Recipe ID
 */
exports.toggleStatus = async (id) => {
  const recipe = await Recipe.findById(id);
  if (!recipe) {
    return null;
  }

  recipe.is_active = !recipe.is_active;
  await recipe.save();

  return recipe;
};

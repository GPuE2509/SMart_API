const recipeService = require("../../services/admin/recipeService");

/**
 * Get all recipes with pagination
 * GET /api/v1/recipes
 * Query params: search, page, limit, sort_by
 */
exports.getAll = async (req, res) => {
  try {
    const result = await recipeService.getAllRecipes(req.query);

    res.json({
      success: true,
      message: "Lấy danh sách công thức thành công",
      data: result.recipes,
      pagination: result.pagination,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách công thức",
      error: error.message,
    });
  }
};

/**
 * Get recipe by ID
 * GET /api/v1/recipes/:id
 */
exports.getById = async (req, res) => {
  try {
    const recipe = await recipeService.getRecipeById(req.params.id);

    if (!recipe) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy công thức",
      });
    }

    res.json({
      success: true,
      message: "Lấy thông tin công thức thành công",
      data: recipe,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Không thể lấy thông tin công thức",
      error: error.message,
    });
  }
};

/**
 * Create new recipe
 * POST /api/v1/recipes
 * Body: { title, description, instruction, image_url, ingredients }
 */
exports.create = async (req, res) => {
  try {
    const recipe = await recipeService.createRecipe(req.body);

    res.status(201).json({
      success: true,
      message: "Tạo công thức thành công",
      data: recipe,
    });
  } catch (error) {
    if (error.message === "Tiêu đề công thức là bắt buộc") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Không thể tạo công thức",
      error: error.message,
    });
  }
};

/**
 * Update recipe
 * PUT /api/v1/recipes/:id
 * Body: { title, description, instruction, image_url, ingredients }
 */
exports.update = async (req, res) => {
  try {
    const recipe = await recipeService.updateRecipe(req.params.id, req.body);

    if (!recipe) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy công thức",
      });
    }

    res.json({
      success: true,
      message: "Cập nhật công thức thành công",
      data: recipe,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Không thể cập nhật công thức",
      error: error.message,
    });
  }
};

/**
 * Delete recipe
 * DELETE /api/v1/recipes/:id
 */
exports.delete = async (req, res) => {
  try {
    const result = await recipeService.deleteRecipe(req.params.id);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy công thức",
      });
    }

    res.json({
      success: true,
      message: "Xóa công thức thành công",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Không thể xóa công thức",
      error: error.message,
    });
  }
};

/**
 * Search/filter recipes
 * GET /api/v1/recipes/search
 * Query params: search, ingredient_id, min_ingredients, max_ingredients, page, limit
 */
exports.search = async (req, res) => {
  try {
    const result = await recipeService.searchRecipes(req.query);

    res.json({
      success: true,
      message: "Tìm kiếm công thức thành công",
      data: result.recipes,
      pagination: result.pagination,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Không thể tìm kiếm công thức",
      error: error.message,
    });
  }
};

/**
 * Toggle recipe active status
 * PATCH /api/v1/recipes/:id/toggle-status
 */
exports.toggleStatus = async (req, res) => {
  try {
    const recipe = await recipeService.toggleStatus(req.params.id);

    if (!recipe) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy công thức",
      });
    }

    res.json({
      success: true,
      message: recipe.is_active ? "Đã bật công thức" : "Đã tắt công thức",
      data: recipe,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Không thể thay đổi trạng thái công thức",
      error: error.message,
    });
  }
};

const categoryService = require("../../services/admin/categoryService");

/**
 * Get all categories with filters, search, and pagination
 * GET /api/v1/categories
 * Query params: search, parent_id, sort_by, sort_order, page, limit
 */
exports.getAll = async (req, res) => {
  try {
    const result = await categoryService.getAllCategories(req.query);

    res.status(200).json({
      success: true,
      message: "Lấy danh sách danh mục thành công",
      data: result.categories,
      pagination: result.pagination,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách danh mục",
      error: error.message,
    });
  }
};

/**
 * Get category by ID
 * GET /api/v1/categories/:id
 */
exports.getById = async (req, res) => {
  try {
    const category = await categoryService.getCategoryById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy danh mục",
      });
    }

    res.status(200).json({
      success: true,
      message: "Lấy thông tin danh mục thành công",
      data: category,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Không thể lấy thông tin danh mục",
      error: error.message,
    });
  }
};

/**
 * Create new category
 * POST /api/v1/categories
 * Body: name, parent_id, description
 */
exports.create = async (req, res) => {
  try {
    const category = await categoryService.createCategory(req.body);

    res.status(201).json({
      success: true,
      message: "Thêm danh mục thành công",
      data: category,
    });
  } catch (error) {
    // Handle validation errors
    if (
      error.message === "Tên danh mục là bắt buộc" ||
      error.message === "Tên danh mục đã tồn tại" ||
      error.message === "Danh mục cha không tồn tại"
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Không thể thêm danh mục",
      error: error.message,
    });
  }
};

/**
 * Update category
 * PUT /api/v1/categories/:id
 * Body: name, parent_id, description
 */
exports.update = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await categoryService.updateCategory(id, req.body);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy danh mục",
      });
    }

    res.status(200).json({
      success: true,
      message: "Cập nhật danh mục thành công",
      data: category,
    });
  } catch (error) {
    // Handle validation errors
    const validationErrors = [
      "Tên danh mục đã tồn tại",
      "Không thể đặt chính nó làm danh mục cha",
      "Danh mục cha không tồn tại",
      "Không thể tạo tham chiếu vòng tròn",
    ];

    if (validationErrors.some((msg) => error.message.includes(msg))) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Không thể cập nhật danh mục",
      error: error.message,
    });
  }
};

/**
 * Delete category (soft delete - set is_active = false)
 * DELETE /api/v1/categories/:id
 */
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await categoryService.deleteCategory(id);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy danh mục",
      });
    }

    res.status(200).json({
      success: true,
      message: "Xóa danh mục thành công",
      deactivatedProducts: result.deactivatedProducts,
    });
  } catch (error) {
    // Handle validation error for subcategories
    if (error.message.includes("Không thể xóa danh mục có danh mục con")) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Không thể xóa danh mục",
      error: error.message,
    });
  }
};

/**
 * Get category tree (hierarchical structure)
 * GET /api/v1/categories/tree
 */
exports.getTree = async (req, res) => {
  try {
    const tree = await categoryService.getCategoryTree();

    res.status(200).json({
      success: true,
      message: "Lấy cây danh mục thành công",
      data: tree,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Không thể lấy cây danh mục",
      error: error.message,
    });
  }
};

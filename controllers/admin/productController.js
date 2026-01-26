const productService = require("../../services/admin/productService");

/**
 * Get all products with filters, search, and pagination
 * GET /api/v1/products
 * Query params: search, category_id, min_price, max_price, sort_by, page, limit
 */
exports.getAll = async (req, res) => {
  try {
    const result = await productService.getAllProducts(req.query);

    res.json({
      success: true,
      data: result.products,
      pagination: result.pagination,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get product by ID with full details
 * GET /api/v1/products/:id
 */
exports.getById = async (req, res) => {
  try {
    const product = await productService.getProductById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sản phẩm",
      });
    }

    res.status(200).json({
      success: true,
      message: "Lấy thông tin sản phẩm thành công",
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Không thể lấy thông tin sản phẩm",
      error: error.message,
    });
  }
};

/**
 * Create new product
 * POST /api/v1/products
 * Body: name, category_id, description, image_url, tax_percentage, price, unit_id
 */
exports.create = async (req, res) => {
  try {
    const product = await productService.createProduct(req.body);

    res.status(201).json({
      success: true,
      message: "Thêm sản phẩm thành công",
      data: product,
    });
  } catch (error) {
    // Handle validation errors
    if (
      error.message === "Tên sản phẩm là bắt buộc" ||
      error.message === "Danh mục không tồn tại"
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Không thể thêm sản phẩm",
      error: error.message,
    });
  }
};

/**
 * Update product
 * PUT /api/v1/products/:id
 * Body: name, category_id, description, image_url, tax_percentage, is_active, price
 */
exports.update = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await productService.updateProduct(id, req.body);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sản phẩm",
      });
    }

    res.status(200).json({
      success: true,
      message: "Cập nhật sản phẩm thành công",
      data: product,
    });
  } catch (error) {
    // Handle validation errors
    if (error.message === "Danh mục không tồn tại") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Không thể cập nhật sản phẩm",
      error: error.message,
    });
  }
};

/**
 * Delete product (soft delete - set is_active = false)
 * DELETE /api/v1/products/:id
 */
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await productService.deleteProduct(id);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sản phẩm",
      });
    }

    res.status(200).json({
      success: true,
      message: "Xóa sản phẩm thành công",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Không thể xóa sản phẩm",
      error: error.message,
    });
  }
};

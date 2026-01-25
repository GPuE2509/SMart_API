const Category = require("../models/Category");
const Product = require("../models/Product");
const ProductUnit = require("../models/ProductUnit");
const { uploadImage } = require("../utils/uploadImage");

/**
 * Helper function to remove Vietnamese diacritics
 * Converts: "Thực phẩm" -> "thuc pham"
 */
const removeVietnameseDiacritics = (str) => {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
};

/**
 * Get all categories with filters, search, and pagination
 * GET /api/v1/categories
 * Query params: search, parent_id, sort_by, sort_order, page, limit
 */
exports.getAll = async (req, res) => {
  try {
    const {
      search,
      parent_id,
      is_active,
      sort_by = "name",
      sort_order = "asc",
      page = 1,
      limit = 20,
    } = req.query;

    // Build query
    let query = {};

    // Filter by is_active only if specified
    if (is_active !== undefined) {
      query.is_active = is_active === "true";
    }

    // Filter by parent category
    if (parent_id === "null" || parent_id === "") {
      query.parent_id = null; // Root categories only
    } else if (parent_id) {
      query.parent_id = parent_id;
    }

    // Get all categories
    let categories = await Category.find(query)
      .populate("parent_id", "name")
      .lean();

    // Search by name (case-insensitive and diacritics-insensitive)
    if (search) {
      const searchNormalized = removeVietnameseDiacritics(search);
      categories = categories.filter((c) => {
        const nameNormalized = removeVietnameseDiacritics(c.name);
        const descNormalized = removeVietnameseDiacritics(c.description || "");
        return (
          nameNormalized.includes(searchNormalized) ||
          descNormalized.includes(searchNormalized)
        );
      });
    }

    // Sort categories
    const sortMultiplier = sort_order === "desc" ? -1 : 1;
    switch (sort_by) {
      case "name":
        categories.sort(
          (a, b) => sortMultiplier * a.name.localeCompare(b.name),
        );
        break;
      case "createdAt":
      case "created":
        categories.sort(
          (a, b) =>
            sortMultiplier * (new Date(a.createdAt) - new Date(b.createdAt)),
        );
        break;
      case "updatedAt":
      case "updated":
        categories.sort(
          (a, b) =>
            sortMultiplier * (new Date(a.updatedAt) - new Date(b.updatedAt)),
        );
        break;
      default:
        categories.sort(
          (a, b) => sortMultiplier * a.name.localeCompare(b.name),
        );
    }

    // Pagination
    const total = categories.length;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedCategories = categories.slice(skip, skip + parseInt(limit));

    // Get product count for each category
    const categoriesWithCount = await Promise.all(
      paginatedCategories.map(async (category) => {
        const productCount = await Product.countDocuments({
          category_id: category._id,
          is_active: true,
        });
        return { ...category, productCount };
      }),
    );

    res.status(200).json({
      success: true,
      message: "Lấy danh sách danh mục thành công",
      data: categoriesWithCount,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error in getAll categories:", error);
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
    const category = await Category.findById(req.params.id)
      .populate("parent_id", "name")
      .lean();

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy danh mục",
      });
    }

    // Get subcategories
    const subcategories = await Category.find({
      parent_id: category._id,
    }).lean();

    // Get product count
    const productCount = await Product.countDocuments({
      category_id: category._id,
      is_active: true,
    });

    res.status(200).json({
      success: true,
      message: "Lấy thông tin danh mục thành công",
      data: {
        ...category,
        subcategories,
        productCount,
      },
    });
  } catch (error) {
    console.error("Error in getById category:", error);
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
    const { name, parent_id, description, image_url } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Tên danh mục là bắt buộc",
      });
    }

    // Check if category name already exists
    const existingCategory = await Category.findOne({ name: name.trim() });
    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: "Tên danh mục đã tồn tại",
      });
    }

    // Validate parent category if provided
    if (parent_id) {
      const parentCategory = await Category.findById(parent_id);
      if (!parentCategory) {
        return res.status(400).json({
          success: false,
          message: "Danh mục cha không tồn tại",
        });
      }
    }

    // Upload image to Cloudinary if provided
    let uploadedImageUrl = "";
    if (image_url) {
      uploadedImageUrl = await uploadImage(image_url, "categories");
    }

    // Create category
    const category = new Category({
      name: name.trim(),
      parent_id: parent_id || null,
      description: description || "",
      image_url: uploadedImageUrl,
    });

    await category.save();

    // Populate and return
    const populatedCategory = await Category.findById(category._id)
      .populate("parent_id", "name")
      .lean();

    res.status(201).json({
      success: true,
      message: "Thêm danh mục thành công",
      data: populatedCategory,
    });
  } catch (error) {
    console.error("Error in create category:", error);
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
    const { name, parent_id, description } = req.body;

    // Check category exists
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy danh mục",
      });
    }

    // Check if new name already exists (excluding current category)
    if (name && name.trim() !== category.name) {
      const existingCategory = await Category.findOne({
        name: name.trim(),
        _id: { $ne: id },
      });
      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message: "Tên danh mục đã tồn tại",
        });
      }
    }

    // Validate parent category if provided
    if (parent_id) {
      // Prevent setting self as parent
      if (parent_id === id) {
        return res.status(400).json({
          success: false,
          message: "Không thể đặt chính nó làm danh mục cha",
        });
      }

      const parentCategory = await Category.findById(parent_id);
      if (!parentCategory) {
        return res.status(400).json({
          success: false,
          message: "Danh mục cha không tồn tại",
        });
      }

      // Prevent circular reference (parent is a child of this category)
      const isCircular = await checkCircularReference(id, parent_id);
      if (isCircular) {
        return res.status(400).json({
          success: false,
          message: "Không thể tạo tham chiếu vòng tròn",
        });
      }
    }

    // Build update object
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (parent_id !== undefined) updateData.parent_id = parent_id || null;
    if (description !== undefined) updateData.description = description;
    if (req.body.is_active !== undefined)
      updateData.is_active = req.body.is_active;

    // Upload image to Cloudinary if new image provided
    if (req.body.image_url !== undefined) {
      if (req.body.image_url && req.body.image_url.startsWith("data:image")) {
        updateData.image_url = await uploadImage(
          req.body.image_url,
          "categories",
        );
      } else {
        updateData.image_url = req.body.image_url;
      }
    }

    // Update category
    const updatedCategory = await Category.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("parent_id", "name")
      .lean();

    res.status(200).json({
      success: true,
      message: "Cập nhật danh mục thành công",
      data: updatedCategory,
    });
  } catch (error) {
    console.error("Error in update category:", error);
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

    // Check category exists
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy danh mục",
      });
    }

    // Check if category has active subcategories
    const activeSubcategories = await Category.find({
      parent_id: id,
      is_active: true,
    });
    if (activeSubcategories.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Không thể xóa danh mục có danh mục con. Vui lòng xóa danh mục con trước.",
        subcategoriesCount: activeSubcategories.length,
      });
    }

    // Count products in this category
    const productCount = await Product.countDocuments({
      category_id: id,
      is_active: true,
    });

    // Soft delete - set is_active = false for category
    await Category.findByIdAndUpdate(id, { is_active: false });

    // Soft delete all products in this category
    await Product.updateMany({ category_id: id }, { is_active: false });

    // Soft delete all product units of products in this category
    const products = await Product.find({ category_id: id });
    const productIds = products.map((p) => p._id);
    await ProductUnit.updateMany(
      { product_id: { $in: productIds } },
      { is_active: false },
    );

    res.status(200).json({
      success: true,
      message: "Xóa danh mục thành công",
      deactivatedProducts: productCount,
    });
  } catch (error) {
    console.error("Error in delete category:", error);
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
    // Get all active categories
    const categories = await Category.find({ is_active: true }).lean();

    // Build tree structure
    const buildTree = (parentId = null) => {
      return categories
        .filter((c) => {
          if (parentId === null) {
            return c.parent_id === null || c.parent_id === undefined;
          }
          return c.parent_id && c.parent_id.toString() === parentId.toString();
        })
        .map((c) => ({
          ...c,
          children: buildTree(c._id),
        }));
    };

    const tree = buildTree(null);

    res.status(200).json({
      success: true,
      message: "Lấy cây danh mục thành công",
      data: tree,
    });
  } catch (error) {
    console.error("Error in getTree categories:", error);
    res.status(500).json({
      success: false,
      message: "Không thể lấy cây danh mục",
      error: error.message,
    });
  }
};

/**
 * Helper function to check circular reference
 */
const checkCircularReference = async (categoryId, newParentId) => {
  let currentParentId = newParentId;
  const visited = new Set();

  while (currentParentId) {
    if (visited.has(currentParentId.toString())) {
      return true; // Circular reference detected
    }
    if (currentParentId.toString() === categoryId.toString()) {
      return true; // New parent is a child of the category
    }
    visited.add(currentParentId.toString());

    const parent = await Category.findById(currentParentId);
    currentParentId = parent?.parent_id;
  }

  return false;
};

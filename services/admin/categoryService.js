const Category = require("../../models/Category");
const Product = require("../../models/admin/Product");
const ProductUnit = require("../../models/admin/ProductUnit");
const { uploadImage } = require("../../utils/uploadImage");

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

/**
 * Get all categories with filters, search, and pagination
 * @param {Object} filters - { search, parent_id, is_active, sort_by, sort_order, page, limit }
 * @returns {Object} - { categories, pagination }
 */
exports.getAllCategories = async (filters) => {
  const {
    search,
    parent_id,
    is_active,
    sort_by = "name",
    sort_order = "asc",
    page = 1,
    limit = 20,
  } = filters;

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
      categories.sort((a, b) => sortMultiplier * a.name.localeCompare(b.name));
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
      categories.sort((a, b) => sortMultiplier * a.name.localeCompare(b.name));
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

  return {
    categories: categoriesWithCount,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  };
};

/**
 * Get category by ID
 * @param {String} id - Category ID
 * @returns {Object} - Category with subcategories and product count
 */
exports.getCategoryById = async (id) => {
  const category = await Category.findById(id)
    .populate("parent_id", "name")
    .lean();

  if (!category) {
    return null;
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

  return {
    ...category,
    subcategories,
    productCount,
  };
};

/**
 * Create new category
 * @param {Object} categoryData - { name, parent_id, description, image_url }
 * @returns {Object} - Created category
 */
exports.createCategory = async (categoryData) => {
  const { name, parent_id, description, image_url, is_active } = categoryData;

  // Validate required fields
  if (!name) {
    throw new Error("Tên danh mục là bắt buộc");
  }

  // Check if category name already exists
  const existingCategory = await Category.findOne({ name: name.trim() });
  if (existingCategory) {
    throw new Error("Tên danh mục đã tồn tại");
  }

  // Validate parent category if provided
  if (parent_id) {
    const parentCategory = await Category.findById(parent_id);
    if (!parentCategory) {
      throw new Error("Danh mục cha không tồn tại");
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
    is_active: is_active !== undefined ? is_active : true,
  });

  await category.save();

  // Populate and return
  const populatedCategory = await Category.findById(category._id)
    .populate("parent_id", "name")
    .lean();

  return populatedCategory;
};

/**
 * Update category
 * @param {String} id - Category ID
 * @param {Object} updateData - { name, parent_id, description, is_active, image_url }
 * @returns {Object} - Updated category
 */
exports.updateCategory = async (id, updateData) => {
  const { name, parent_id, description, is_active, image_url } = updateData;

  // Check category exists
  const category = await Category.findById(id);
  if (!category) {
    return null;
  }

  // Check if new name already exists (excluding current category)
  if (name && name.trim() !== category.name) {
    const existingCategory = await Category.findOne({
      name: name.trim(),
      _id: { $ne: id },
    });
    if (existingCategory) {
      throw new Error("Tên danh mục đã tồn tại");
    }
  }

  // Validate parent category if provided
  if (parent_id) {
    // Prevent setting self as parent
    if (parent_id === id) {
      throw new Error("Không thể đặt chính nó làm danh mục cha");
    }

    const parentCategory = await Category.findById(parent_id);
    if (!parentCategory) {
      throw new Error("Danh mục cha không tồn tại");
    }

    // Prevent circular reference (parent is a child of this category)
    const isCircular = await checkCircularReference(id, parent_id);
    if (isCircular) {
      throw new Error("Không thể tạo tham chiếu vòng tròn");
    }
  }

  // Build update object
  const updateFields = {};
  if (name !== undefined) updateFields.name = name.trim();
  if (parent_id !== undefined) updateFields.parent_id = parent_id || null;
  if (description !== undefined) updateFields.description = description;
  if (is_active !== undefined) updateFields.is_active = is_active;

  // Upload image to Cloudinary if new image provided
  if (image_url !== undefined) {
    if (image_url && image_url.startsWith("data:image")) {
      updateFields.image_url = await uploadImage(image_url, "categories");
    } else {
      updateFields.image_url = image_url;
    }
  }

  // Update category
  const updatedCategory = await Category.findByIdAndUpdate(id, updateFields, {
    new: true,
    runValidators: true,
  })
    .populate("parent_id", "name")
    .lean();

  return updatedCategory;
};

/**
 * Delete category (soft delete - set is_active = false)
 * @param {String} id - Category ID
 * @returns {Object} - { success, deactivatedProducts } or null if not found
 */
exports.deleteCategory = async (id) => {
  // Check category exists
  const category = await Category.findById(id);
  if (!category) {
    return null;
  }

  // Check if category has active subcategories
  const activeSubcategories = await Category.find({
    parent_id: id,
    is_active: true,
  });
  if (activeSubcategories.length > 0) {
    throw new Error(
      `Không thể xóa danh mục có danh mục con. Vui lòng xóa danh mục con trước. (${activeSubcategories.length} danh mục con)`,
    );
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

  return {
    success: true,
    deactivatedProducts: productCount,
  };
};

/**
 * Get category tree (hierarchical structure)
 * @returns {Array} - Tree structure of categories
 */
exports.getCategoryTree = async () => {
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

  return buildTree(null);
};

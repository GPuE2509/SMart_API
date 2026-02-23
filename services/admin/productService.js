const Product = require("../../models/Product");
const ProductUnit = require("../../models/ProductUnit");
const Category = require("../../models/Category");
const { uploadImage } = require("../../utils/uploadImage");


const removeVietnameseDiacritics = (str) => {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
};


exports.getAllProducts = async (filters) => {
  const {
    search,
    category_id,
    is_active,
    min_price,
    max_price,
    sort_by = "name",
    page = 1,
    limit = 20,
  } = filters;

  // Build query
  let query = {};

  // Filter by is_active only if specified
  if (is_active !== undefined) {
    query.is_active = is_active === "true";
  }

  // Filter by category
  if (category_id) {
    query.category_id = category_id;
  }

  // Build sort
  let sort = {};
  let needsPriceSort = false;

  switch (sort_by) {
    case "name":
      sort = { name: 1 };
      break;
    case "price-asc":
    case "price-desc":
      needsPriceSort = true;
      break;
    case "newest":
      sort = { createdAt: -1 };
      break;
    default:
      sort = { name: 1 };
  }

  // If searching, filtering by price, or sorting by price - need to process in memory
  if (search || needsPriceSort || min_price || max_price) {
    let allProducts = await Product.find(query)
      .populate("category_id", "name")
      .lean();

    // Get base unit price for each product
    let productsWithPrice = await Promise.all(
      allProducts.map(async (product) => {
        const baseUnit = await ProductUnit.findOne({
          product_id: product._id,
          is_base_unit: true,
          is_active: true,
        });

        const price = baseUnit?.price || 0;
        return { ...product, price };
      }),
    );

    // Search by name or description (case-insensitive and diacritics-insensitive)
    if (search) {
      const searchNormalized = removeVietnameseDiacritics(search);
      productsWithPrice = productsWithPrice.filter((p) => {
        const nameNormalized = removeVietnameseDiacritics(p.name);
        const descNormalized = removeVietnameseDiacritics(p.description || "");
        return (
          nameNormalized.includes(searchNormalized) ||
          descNormalized.includes(searchNormalized)
        );
      });
    }

    // Filter by price range
    let filteredProducts = productsWithPrice.filter((p) => {
      if (min_price && p.price < parseInt(min_price)) return false;
      if (max_price && p.price > parseInt(max_price)) return false;
      return true;
    });

    // Sort filtered products
    if (sort_by === "price-asc") {
      filteredProducts.sort((a, b) => a.price - b.price);
    } else if (sort_by === "price-desc") {
      filteredProducts.sort((a, b) => b.price - a.price);
    } else if (sort_by === "newest") {
      filteredProducts.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      );
    } else if (sort_by === "name") {
      filteredProducts.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Pagination
    const total = filteredProducts.length;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    const paginatedProducts = filteredProducts.slice(skip, skip + limitNum);

    return {
      products: paginatedProducts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  // No price filter or sort - use efficient DB query
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;
  let products = await Product.find(query)
    .populate("category_id", "name")
    .sort(sort)
    .limit(limitNum)
    .skip(skip)
    .lean();

  // Add base unit price to response
  products = await Promise.all(
    products.map(async (product) => {
      const baseUnit = await ProductUnit.findOne({
        product_id: product._id,
        is_base_unit: true,
        is_active: true,
      });

      const price = baseUnit?.price || 0;
      return { ...product, price };
    }),
  );

  // Get total count
  const total = await Product.countDocuments(query);

  return {
    products,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  };
};

/**
 * Get product by ID with full details
 * @param {String} id - Product ID
 * @returns {Object} - Product with units
 */
exports.getProductById = async (id) => {
  const product = await Product.findById(id)
    .populate("category_id", "name")
    .lean();

  if (!product) {
    return null;
  }

  // Get all product units
  const productUnits = await ProductUnit.find({
    product_id: product._id,
    is_active: true,
  }).populate("unit_id", "name");

  // Get base unit price
  const baseUnit = productUnits.find((pu) => pu.is_base_unit);

  return {
    ...product,
    price: baseUnit?.price || 0,
    unit: baseUnit?.unit_id || null,
    productUnits: productUnits,
  };
};

/**
 * Create new product
 * @param {Object} productData - { name, category_id, description, image_url, tax_percentage, price, unit_id }
 * @returns {Object} - Created product
 */
exports.createProduct = async (productData) => {
  const {
    name,
    category_id,
    description,
    image_url,
    tax_percentage,
    price,
    unit_id,
    is_active,
  } = productData;

  // Validate required fields
  if (!name) {
    throw new Error("Tên sản phẩm là bắt buộc");
  }

  // Validate category if provided
  if (category_id) {
    const category = await Category.findById(category_id);
    if (!category) {
      throw new Error("Danh mục không tồn tại");
    }
  }

  // Upload image to Cloudinary if provided
  let uploadedImageUrl = "";
  if (image_url) {
    uploadedImageUrl = await uploadImage(image_url, "products");
  }

  // Create product
  const product = new Product({
    name,
    category_id: category_id || null,
    description: description || "",
    image_url: uploadedImageUrl,
    tax_percentage: tax_percentage !== undefined ? tax_percentage : 8.0,
    total_stock: 0,
    is_active: is_active !== undefined ? is_active : true,
  });

  await product.save();

  // If price and unit_id provided, create base ProductUnit
  if (price && unit_id) {
    const productUnit = new ProductUnit({
      product_id: product._id,
      unit_id: unit_id,
      exchange_value: 1,
      price: price,
      is_base_unit: true,
      is_active: true,
    });
    await productUnit.save();
  }

  // Populate and return
  const populatedProduct = await Product.findById(product._id)
    .populate("category_id", "name")
    .lean();

  // Get price from ProductUnit
  const baseUnit = await ProductUnit.findOne({
    product_id: product._id,
    is_base_unit: true,
  }).populate("unit_id", "name");

  return {
    ...populatedProduct,
    price: baseUnit?.price || 0,
    unit: baseUnit?.unit_id || null,
  };
};

/**
 * Update product
 * @param {String} id - Product ID
 * @param {Object} updateData - { name, category_id, description, image_url, tax_percentage, is_active, price }
 * @returns {Object} - Updated product
 */
exports.updateProduct = async (id, updateData) => {
  const {
    name,
    category_id,
    description,
    image_url,
    tax_percentage,
    is_active,
    price,
  } = updateData;

  // Check product exists
  const product = await Product.findById(id);
  if (!product) {
    return null;
  }

  // Validate category if provided
  if (category_id) {
    const category = await Category.findById(category_id);
    if (!category) {
      throw new Error("Danh mục không tồn tại");
    }
  }

  // Upload image to Cloudinary if new image provided
  let uploadedImageUrl = image_url;
  if (image_url && image_url.startsWith("data:image")) {
    uploadedImageUrl = await uploadImage(image_url, "products");
  }

  // Build update object
  const updateFields = {};
  if (name !== undefined) updateFields.name = name;
  if (category_id !== undefined) updateFields.category_id = category_id;
  if (description !== undefined) updateFields.description = description;
  if (uploadedImageUrl !== undefined) updateFields.image_url = uploadedImageUrl;
  if (tax_percentage !== undefined)
    updateFields.tax_percentage = tax_percentage;
  if (is_active !== undefined) updateFields.is_active = is_active;

  // Update product
  const updatedProduct = await Product.findByIdAndUpdate(id, updateFields, {
    new: true,
    runValidators: true,
  })
    .populate("category_id", "name")
    .lean();

  // Update price in base ProductUnit if provided
  if (price !== undefined) {
    await ProductUnit.findOneAndUpdate(
      { product_id: id, is_base_unit: true },
      { price: price },
      { new: true },
    );
  }

  // Get base unit price
  const baseUnit = await ProductUnit.findOne({
    product_id: id,
    is_base_unit: true,
  }).populate("unit_id", "name");

  return {
    ...updatedProduct,
    price: baseUnit?.price || 0,
    unit: baseUnit?.unit_id || null,
  };
};

/**
 * Delete product (soft delete - set is_active = false)
 * @param {String} id - Product ID
 * @returns {Boolean} - Success status
 */
exports.deleteProduct = async (id) => {
  // Check product exists
  const product = await Product.findById(id);
  if (!product) {
    return null;
  }

  // Soft delete - set is_active = false
  await Product.findByIdAndUpdate(id, { is_active: false });

  // Also deactivate all product units
  await ProductUnit.updateMany({ product_id: id }, { is_active: false });

  return true;
};

const Product = require("../models/Product");
const ProductUnit = require("../models/ProductUnit");
const Category = require("../models/Category");
const { uploadImage } = require("../utils/uploadImage");

/**
 * Helper function to remove Vietnamese diacritics
 * Converts: "Sữa Vinamilk" -> "sua vinamilk"
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
 * Get all products with filters, search, and pagination
 * GET /api/v1/products
 * Query params: search, category_id, min_price, max_price, sort_by, page, limit
 */
exports.getAll = async (req, res) => {
  try {
    const {
      search,
      category_id,
      is_active,
      min_price,
      max_price,
      sort_by = "name",
      page = 1,
      limit = 20,
    } = req.query;

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
          const descNormalized = removeVietnameseDiacritics(
            p.description || "",
          );
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
      const skip = (page - 1) * limit;
      const paginatedProducts = filteredProducts.slice(
        skip,
        skip + parseInt(limit),
      );

      return res.json({
        success: true,
        data: paginatedProducts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    }

    // No price filter or sort - use efficient DB query
    const skip = (page - 1) * limit;
    let products = await Product.find(query)
      .populate("category_id", "name")
      .sort(sort)
      .limit(parseInt(limit))
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

    res.json({
      success: true,
      data: products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
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
    const {
      name,
      category_id,
      description,
      image_url,
      tax_percentage,
      price,
      unit_id,
    } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Tên sản phẩm là bắt buộc",
      });
    }

    // Validate category if provided
    if (category_id) {
      const category = await Category.findById(category_id);
      if (!category) {
        return res.status(400).json({
          success: false,
          message: "Danh mục không tồn tại",
        });
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
      tax_percentage: tax_percentage || 8.0,
      total_stock: 0,
      is_active: true,
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

    res.status(201).json({
      success: true,
      message: "Thêm sản phẩm thành công",
      data: {
        ...populatedProduct,
        price: baseUnit?.price || 0,
        unit: baseUnit?.unit_id || null,
      },
    });
  } catch (error) {
    console.error("Error in create product:", error);
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
    const {
      name,
      category_id,
      description,
      image_url,
      tax_percentage,
      is_active,
      price,
    } = req.body;

    console.log("Update product request:", { id, is_active, body: req.body });

    // Check product exists
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sản phẩm",
      });
    }

    // Validate category if provided
    if (category_id) {
      const category = await Category.findById(category_id);
      if (!category) {
        return res.status(400).json({
          success: false,
          message: "Danh mục không tồn tại",
        });
      }
    }

    // Upload image to Cloudinary if new image provided
    let uploadedImageUrl = image_url;
    if (image_url && image_url.startsWith("data:image")) {
      uploadedImageUrl = await uploadImage(image_url, "products");
    }

    // Build update object
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (category_id !== undefined) updateData.category_id = category_id;
    if (description !== undefined) updateData.description = description;
    if (uploadedImageUrl !== undefined) updateData.image_url = uploadedImageUrl;
    if (tax_percentage !== undefined)
      updateData.tax_percentage = tax_percentage;
    if (is_active !== undefined) updateData.is_active = is_active;

    console.log("Update data:", updateData);

    // Update product
    const updatedProduct = await Product.findByIdAndUpdate(id, updateData, {
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

    res.status(200).json({
      success: true,
      message: "Cập nhật sản phẩm thành công",
      data: {
        ...updatedProduct,
        price: baseUnit?.price || 0,
        unit: baseUnit?.unit_id || null,
      },
    });
  } catch (error) {
    console.error("Error in update product:", error);
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

    // Check product exists
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sản phẩm",
      });
    }

    // Soft delete - set is_active = false
    await Product.findByIdAndUpdate(id, { is_active: false });

    // Also deactivate all product units
    await ProductUnit.updateMany({ product_id: id }, { is_active: false });

    res.status(200).json({
      success: true,
      message: "Xóa sản phẩm thành công",
    });
  } catch (error) {
    console.error("Error in delete product:", error);
    res.status(500).json({
      success: false,
      message: "Không thể xóa sản phẩm",
      error: error.message,
    });
  }
};

/**
 * Get product by ID with full details
 * GET /api/v1/products/:id
 */
exports.getById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("category_id", "name")
      .lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sản phẩm",
      });
    }

    // Get all product units
    const productUnits = await ProductUnit.find({
      product_id: product._id,
      is_active: true,
    }).populate("unit_id", "name");

    // Get base unit price
    const baseUnit = productUnits.find((pu) => pu.is_base_unit);

    res.status(200).json({
      success: true,
      message: "Lấy thông tin sản phẩm thành công",
      data: {
        ...product,
        price: baseUnit?.price || 0,
        unit: baseUnit?.unit_id || null,
        productUnits: productUnits,
      },
    });
  } catch (error) {
    console.error("Error in getById:", error);
    res.status(500).json({
      success: false,
      message: "Không thể lấy thông tin sản phẩm",
      error: error.message,
    });
  }
};

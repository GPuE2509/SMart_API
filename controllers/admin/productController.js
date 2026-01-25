const Product = require("../../models/admin/Product");
const ProductUnit = require("../../models/admin/ProductUnit");

// Get all products with filters and sort
exports.getAll = async (req, res) => {
  try {
    const {
      search,
      category_id,
      min_price,
      max_price,
      sort_by = "name",
      page = 1,
      limit = 20,
    } = req.query;

    // Build query
    let query = { is_active: true };

    // Search by name
    if (search) {
      query.name = { $regex: search, $options: "i" };
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
        needsPriceSort = true; // Sort in memory after getting prices
        break;
      case "newest":
        sort = { createdAt: -1 };
        break;
      default:
        sort = { name: 1 };
    }

    // If sorting by price OR filtering by price, need to get all products first
    if (needsPriceSort || min_price || max_price) {
      let allProducts = await Product.find(query)
        .populate("category_id", "name")
        .lean();

      // Get base unit price for each product
      const productsWithPrice = await Promise.all(
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

// Get product by ID
exports.getById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sản phẩm",
      });
    }

    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

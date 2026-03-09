const { Product, Category, ProductUnit, Unit } = require("../../models");

const productService = {
  /**
   * Get all products with filters (for customers)
   */
  getAll: async (filters = {}) => {
    try {
      const {
        search,
        category_id,
        min_price,
        max_price,
        sort_by = "createdAt",
        order = "DESC",
        page = 1,
        limit = 20,
      } = filters;

      // Build query
      const query = {
        is_active: true, // Only show active products
      };

      // Search by name or description
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
        ];
      }

      // Filter by category
      if (category_id) {
        query.category_id = category_id;
      }

      const sortOrder = order === "DESC" ? -1 : 1;

      // Get ALL products matching query first (no pagination yet)
      let products = await Product.find(query)
        .populate({
          path: "category_id",
          select: "name description image_url",
        })
        .sort(sort_by !== "price" ? { [sort_by]: sortOrder } : { name: 1 })
        .lean();

      // Get product units for each product and calculate prices
      for (let product of products) {
        const units = await ProductUnit.find({
          product_id: product._id,
          is_active: true,
        })
          .populate("unit_id", "name")
          .lean();

        product.units = units;

        // Calculate price range
        if (units.length > 0) {
          const prices = units.map((u) => u.price);
          product.min_price = Math.min(...prices);
          product.max_price = Math.max(...prices);
        } else {
          product.min_price = 0;
          product.max_price = 0;
        }
      }

      // Filter by price range if specified (BEFORE pagination)
      if (min_price || max_price) {
        products = products.filter((product) => {
          if (!product.units || product.units.length === 0) return false;

          if (min_price && product.max_price < parseFloat(min_price))
            return false;
          if (max_price && product.min_price > parseFloat(max_price))
            return false;

          return true;
        });
      }

      // Sort by price if requested (BEFORE pagination)
      if (sort_by === "price") {
        products.sort((a, b) => {
          const priceA = a.min_price || 0;
          const priceB = b.min_price || 0;
          return sortOrder === 1 ? priceA - priceB : priceB - priceA;
        });
      }

      // Calculate total AFTER filtering
      const total = products.length;

      // Apply pagination LAST
      const skip = (parseInt(page) - 1) * parseInt(limit);
      products = products.slice(skip, skip + parseInt(limit));

      return {
        success: true,
        data: {
          products: products,
          pagination: {
            total: total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / parseInt(limit)),
          },
        },
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get product by ID with full details
   */
  getById: async (id) => {
    try {
      const product = await Product.findOne({
        _id: id,
        is_active: true,
      })
        .populate({
          path: "category_id",
          select: "name description image_url",
        })
        .lean();

      if (!product) {
        return {
          success: false,
          message: "Product not found",
        };
      }

      // Get product units
      const units = await ProductUnit.find({
        product_id: product._id,
        is_active: true,
      })
        .populate("unit_id", "name")
        .lean();

      // Calculate available stock for each unit from ProductBatch
      const ProductBatch = require("../../models/ProductBatch");

      for (let unit of units) {
        // Find all batches that have this product + unit combination with stock
        const batches = await ProductBatch.find({
          "items.product_id": product._id,
          "items.unit_id": unit.unit_id._id,
          "items.status": "onsale",
          is_deleted: false,
        }).lean();

        // Sum up current_quantity from all matching batch items
        let totalStock = 0;
        for (let batch of batches) {
          for (let item of batch.items) {
            if (
              item.product_id.toString() === product._id.toString() &&
              item.unit_id.toString() === unit.unit_id._id.toString() &&
              item.status === "onsale"
            ) {
              totalStock += item.current_quantity;
            }
          }
        }

        unit.available_stock = totalStock;
      }

      product.units = units;

      // Calculate total stock across all units
      product.total_stock = units.reduce(
        (sum, unit) => sum + (unit.available_stock || 0),
        0,
      );

      return {
        success: true,
        data: product,
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get featured products (can be used for home page)
   */
  getFeatured: async (limit = 10) => {
    try {
      // Get latest active products as featured
      let products = await Product.find({
        is_active: true,
      })
        .populate({
          path: "category_id",
          select: "name description image_url",
        })
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .lean();

      // Get product units for each product
      for (let product of products) {
        const units = await ProductUnit.find({
          product_id: product._id,
          is_active: true,
        })
          .populate("unit_id", "name")
          .lean();

        product.units = units;
      }

      return {
        success: true,
        data: products,
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get related products by category
   */
  getRelated: async (productId, limit = 5) => {
    try {
      // Get the product first
      const product = await Product.findOne({
        _id: productId,
        is_active: true,
      });

      if (!product) {
        return {
          success: false,
          message: "Product not found",
        };
      }

      // Find related products in same category
      let relatedProducts = await Product.find({
        category_id: product.category_id,
        _id: { $ne: productId },
        is_active: true,
      })
        .populate({
          path: "category_id",
          select: "name description image_url",
        })
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .lean();

      // Get product units for each product
      for (let relatedProduct of relatedProducts) {
        const units = await ProductUnit.find({
          product_id: relatedProduct._id,
          is_active: true,
        })
          .populate("unit_id", "name")
          .lean();

        relatedProduct.units = units;
      }

      return {
        success: true,
        data: relatedProducts,
      };
    } catch (error) {
      throw error;
    }
  },
};

module.exports = productService;

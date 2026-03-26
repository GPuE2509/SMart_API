const {
  Product,
  Category,
  ProductUnit,
  Unit,
  ProductBatch,
} = require("../../models");

const isBatchItemSellable = (batchItem, now = new Date()) => {
  if (!batchItem) return false;
  if (batchItem.status !== "onsale") return false;
  if (Number(batchItem.current_quantity || 0) <= 0) return false;

  if (!batchItem.expiry_date) return true;
  const expiry = new Date(batchItem.expiry_date);
  if (Number.isNaN(expiry.getTime())) return true;

  return expiry >= now;
};

const getBatchItemDiscountPercentage = (item) => {
  if (
    item?.rescue_pricing_enabled &&
    item?.rescue_pricing_active &&
    Number(item?.rescue_discount_percentage || 0) > 0
  ) {
    return Number(item.rescue_discount_percentage);
  }

  if (
    !item?.rescue_pricing_enabled &&
    Number(item?.manual_discount_percentage || 0) > 0
  ) {
    return Number(item.manual_discount_percentage);
  }

  return 0;
};

const getBatchItemExpiryTime = (item) => {
  if (!item?.expiry_date) return Number.MAX_SAFE_INTEGER;
  const t = new Date(item.expiry_date).getTime();
  return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
};

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
      const normalizedSearch = String(search || "")
        .trim()
        .toLocaleLowerCase();

      // Build query
      const query = {
        is_active: true, // Only show active products
      };

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
        product.available_stock = 0;

        // Calculate price range
        if (units.length > 0) {
          const prices = units.map((u) => u.price);
          product.min_price = Math.min(...prices);
          product.max_price = Math.max(...prices);
        } else {
          product.min_price = 0;
          product.max_price = 0;
        }

        // Find max effective discount available for this product (rescue or manual)
        product.maxRescueDiscount = 0;
        product.displayRescueDiscount = 0;
        product.discounted_stock = 0;
        let nearestExpiryTime = Number.MAX_SAFE_INTEGER;
        const discountedStockBreakdownMap = new Map();
        try {
          const batches = await ProductBatch.find({
            "items.product_id": product._id,
            "items.status": "onsale",
            is_deleted: false,
          }).lean();

          for (let batch of batches) {
            for (let item of batch.items) {
              const discountPercentage = getBatchItemDiscountPercentage(item);

              if (
                item.product_id.toString() === product._id.toString() &&
                isBatchItemSellable(item)
              ) {
                product.available_stock += Number(item.current_quantity || 0);
              }

              if (
                item.product_id.toString() === product._id.toString() &&
                isBatchItemSellable(item) &&
                discountPercentage > product.maxRescueDiscount
              ) {
                product.maxRescueDiscount = discountPercentage;
              }

              if (
                item.product_id.toString() === product._id.toString() &&
                isBatchItemSellable(item) &&
                discountPercentage > 0
              ) {
                product.discounted_stock += Number(item.current_quantity || 0);

                const currentQty =
                  Number(
                    discountedStockBreakdownMap.get(discountPercentage) || 0,
                  ) + Number(item.current_quantity || 0);
                discountedStockBreakdownMap.set(discountPercentage, currentQty);
              }

              if (
                item.product_id.toString() === product._id.toString() &&
                isBatchItemSellable(item)
              ) {
                const expiryTime = getBatchItemExpiryTime(item);
                if (expiryTime < nearestExpiryTime) {
                  nearestExpiryTime = expiryTime;
                  product.displayRescueDiscount = discountPercentage;
                }
              }
            }
          }
        } catch (err) {
          console.error("Error fetching rescue pricing:", err);
        }

        product.discounted_stock_breakdown = Array.from(
          discountedStockBreakdownMap.entries(),
        )
          .map(([discount_percentage, quantity]) => ({
            discount_percentage: Number(discount_percentage),
            quantity: Number(quantity || 0),
          }))
          .sort((a, b) => b.discount_percentage - a.discount_percentage);
      }

      // Only show products customers can actually buy now.
      products = products.filter(
        (product) =>
          Array.isArray(product.units) &&
          product.units.length > 0 &&
          Number(product.available_stock || 0) > 0,
      );

      // Case-insensitive discovery search on product text fields.
      if (normalizedSearch) {
        products = products.filter((product) => {
          const name = String(product.name || "").toLocaleLowerCase();
          const description = String(
            product.description || "",
          ).toLocaleLowerCase();
          return (
            name.includes(normalizedSearch) ||
            description.includes(normalizedSearch)
          );
        });
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

      // Calculate available stock and rescue pricing for each unit
      for (let unit of units) {
        // Find all batches that have this product + unit combination with stock
        const batches = await ProductBatch.find({
          "items.product_id": product._id,
          "items.unit_id": unit.unit_id._id,
          "items.status": "onsale",
          is_deleted: false,
        }).lean();

        // Sum up current_quantity and find max effective discount
        let totalStock = 0;
        let maxRescueDiscount = 0;
        let displayRescueDiscount = 0;
        let discountedStock = 0;
        let nearestExpiryTime = Number.MAX_SAFE_INTEGER;
        const discountedStockBreakdownMap = new Map();

        for (let batch of batches) {
          for (let item of batch.items) {
            if (
              item.product_id.toString() === product._id.toString() &&
              item.unit_id.toString() === unit.unit_id._id.toString() &&
              isBatchItemSellable(item)
            ) {
              totalStock += item.current_quantity;

              const discountPercentage = getBatchItemDiscountPercentage(item);

              if (discountPercentage > maxRescueDiscount) {
                maxRescueDiscount = discountPercentage;
              }

              if (discountPercentage > 0) {
                discountedStock += Number(item.current_quantity || 0);
                const currentQty =
                  Number(
                    discountedStockBreakdownMap.get(discountPercentage) || 0,
                  ) + Number(item.current_quantity || 0);
                discountedStockBreakdownMap.set(discountPercentage, currentQty);
              }

              const expiryTime = getBatchItemExpiryTime(item);
              if (expiryTime < nearestExpiryTime) {
                nearestExpiryTime = expiryTime;
                displayRescueDiscount = discountPercentage;
              }
            }
          }
        }

        unit.available_stock = totalStock;
        unit.maxRescueDiscount = maxRescueDiscount;
        unit.displayRescueDiscount = displayRescueDiscount;
        unit.discounted_stock = discountedStock;
        unit.discounted_stock_breakdown = Array.from(
          discountedStockBreakdownMap.entries(),
        )
          .map(([discount_percentage, quantity]) => ({
            discount_percentage: Number(discount_percentage),
            quantity: Number(quantity || 0),
          }))
          .sort((a, b) => b.discount_percentage - a.discount_percentage);
      }

      product.units = units;

      // Calculate total stock across all units
      product.total_stock = units.reduce(
        (sum, unit) => sum + (unit.available_stock || 0),
        0,
      );

      // Get max rescue discount across all units
      product.maxRescueDiscount = Math.max(
        ...units.map((u) => u.maxRescueDiscount || 0),
        0,
      );
      product.displayRescueDiscount = Math.max(
        ...units.map((u) => u.displayRescueDiscount || 0),
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
      // Get active products and then keep only items customers can buy now.
      const requestedLimit = parseInt(limit);
      const fetchLimit = Number.isNaN(requestedLimit)
        ? 20
        : Math.max(requestedLimit * 3, requestedLimit, 20);

      let products = await Product.find({
        is_active: true,
      })
        .populate({
          path: "category_id",
          select: "name description image_url",
        })
        .sort({ createdAt: -1 })
        .limit(fetchLimit)
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

        // Aggregate total sellable stock across all eligible batch items.
        let availableStock = 0;
        const batches = await ProductBatch.find({
          "items.product_id": product._id,
          "items.status": "onsale",
          is_deleted: false,
        }).lean();

        for (let batch of batches) {
          for (let item of batch.items) {
            if (
              item.product_id.toString() === product._id.toString() &&
              isBatchItemSellable(item)
            ) {
              availableStock += Number(item.current_quantity || 0);
            }
          }
        }

        product.available_stock = availableStock;
      }

      products = products
        .filter(
          (product) =>
            Array.isArray(product.units) &&
            product.units.length > 0 &&
            Number(product.available_stock || 0) > 0,
        )
        .slice(0, Number.isNaN(requestedLimit) ? 10 : requestedLimit);

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

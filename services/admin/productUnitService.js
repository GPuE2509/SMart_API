const ProductUnit = require("../../models/admin/ProductUnit");
const Product = require("../../models/admin/Product");
const Unit = require("../../models/admin/Unit");

/**
 * Get all product units with filters, search, and pagination
 * @param {Object} filters - { product_id, unit_id, is_base_unit, search, page, limit }
 * @returns {Object} - { productUnits, total, page, totalPages }
 */
exports.getAllProductUnits = async (filters) => {
  try {
    const {
      product_id,
      unit_id,
      is_base_unit,
      search,
      page = 1,
      limit = 20,
      sort_by = "createdAt",
      sort_order = "desc",
    } = filters;

    // Build query
    let query = {};

    // Filter by product
    if (product_id) {
      query.product_id = product_id;
    }

    // Filter by unit
    if (unit_id) {
      query.unit_id = unit_id;
    }

    // Filter by base unit
    if (is_base_unit !== undefined) {
      query.is_base_unit = is_base_unit === "true" || is_base_unit === true;
    }

    // Search by barcode or product name
    let productUnits;
    const skip = (page - 1) * limit;
    const sortOptions = {};
    sortOptions[sort_by] = sort_order === "asc" ? 1 : -1;

    if (search) {
      // Search in product name
      const productIds = await Product.find({
        name: { $regex: search, $options: "i" },
      }).select("_id");

      const productIdsArray = productIds.map((p) => p._id);

      // Combine queries
      const combinedQuery = {
        ...query,
        $or: [
          { barcode: { $regex: search, $options: "i" } },
          { product_id: { $in: productIdsArray } },
        ],
      };

      productUnits = await ProductUnit.find(combinedQuery)
        .populate("product_id", "name image_url category_id is_active")
        .populate("unit_id", "name")
        .limit(parseInt(limit))
        .skip(skip)
        .sort(sortOptions);

      const total = await ProductUnit.countDocuments(combinedQuery);

      return {
        productUnits,
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / limit),
        limit: parseInt(limit),
      };
    }

    // Normal query without search
    productUnits = await ProductUnit.find(query)
      .populate("product_id", "name image_url category_id is_active")
      .populate("unit_id", "name")
      .limit(parseInt(limit))
      .skip(skip)
      .sort(sortOptions);

    const total = await ProductUnit.countDocuments(query);

    return {
      productUnits,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      limit: parseInt(limit),
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Get product unit by ID
 * @param {String} id - Product Unit ID
 * @returns {Object} - Product Unit
 */
exports.getProductUnitById = async (id) => {
  try {
    const productUnit = await ProductUnit.findById(id)
      .populate(
        "product_id",
        "name image_url category_id is_active tax_percentage",
      )
      .populate("unit_id", "name");

    if (!productUnit) {
      throw new Error("Không tìm thấy đơn vị sản phẩm");
    }

    return productUnit;
  } catch (error) {
    throw error;
  }
};

/**
 * Get all product units by product ID
 * @param {String} productId - Product ID
 * @returns {Array} - Product Units
 */
exports.getProductUnitsByProductId = async (productId) => {
  try {
    const productUnits = await ProductUnit.find({ product_id: productId })
      .populate("unit_id", "name")
      .sort({ is_base_unit: -1, exchange_value: 1 });

    return productUnits;
  } catch (error) {
    throw error;
  }
};

/**
 * Update product unit
 * @param {String} id - Product Unit ID
 * @param {Object} data - Update data
 * @returns {Object} - Updated Product Unit
 */
exports.updateProductUnit = async (id, data) => {
  try {
    // Validate product unit exists
    const existingUnit = await ProductUnit.findById(id);
    if (!existingUnit) {
      throw new Error("Không tìm thấy đơn vị sản phẩm");
    }

    // If updating to base unit, ensure no other base unit exists for this product
    if (data.is_base_unit === true) {
      const otherBaseUnit = await ProductUnit.findOne({
        product_id: existingUnit.product_id,
        is_base_unit: true,
        _id: { $ne: id },
      });

      if (otherBaseUnit) {
        throw new Error(
          "Sản phẩm đã có đơn vị cơ sở. Vui lòng tắt đơn vị cơ sở hiện tại trước.",
        );
      }
    }

    // If barcode is being updated, check uniqueness
    if (data.barcode && data.barcode !== existingUnit.barcode) {
      const duplicateBarcode = await ProductUnit.findOne({
        barcode: data.barcode,
        _id: { $ne: id },
      });

      if (duplicateBarcode) {
        throw new Error("Mã vạch đã tồn tại");
      }
    }

    // Update product unit
    const productUnit = await ProductUnit.findByIdAndUpdate(
      id,
      { ...data, updatedAt: Date.now() },
      { new: true, runValidators: true },
    )
      .populate("product_id", "name image_url category_id is_active")
      .populate("unit_id", "name");

    return productUnit;
  } catch (error) {
    throw error;
  }
};

/**
 * Delete product unit permanently
 * @param {String} id - Product Unit ID
 * @returns {Object} - Result message
 */
exports.deleteProductUnit = async (id) => {
  try {
    const productUnit = await ProductUnit.findById(id);

    if (!productUnit) {
      throw new Error("Không tìm thấy đơn vị sản phẩm");
    }

    // Check if it's a base unit
    if (productUnit.is_base_unit) {
      throw new Error(
        "Không thể xóa đơn vị cơ sở. Vui lòng đặt đơn vị khác làm cơ sở trước.",
      );
    }

    await ProductUnit.findByIdAndDelete(id);

    return {
      message: "Đã xóa đơn vị sản phẩm thành công",
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Calculate EAN-13 check digit
 * @param {String} barcode12 - First 12 digits of barcode
 * @returns {String} - Check digit (0-9)
 */
const calculateEAN13CheckDigit = (barcode12) => {
  if (barcode12.length !== 12) {
    throw new Error("Mã vạch phải có 12 chữ số để tính chữ số kiểm tra");
  }

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(barcode12[i]);
    // Odd positions (1st, 3rd, 5th...) multiply by 1
    // Even positions (2nd, 4th, 6th...) multiply by 3
    sum += i % 2 === 0 ? digit : digit * 3;
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit.toString();
};

/**
 * Generate internal barcode (EAN-13 format)
 * Format: 22 + Product_ID(5) + Unit_ID(5) + Check_digit
 * @param {String} productId - MongoDB ObjectId
 * @param {String} unitId - MongoDB ObjectId (unit_id)
 * @returns {String} - 13-digit fixed barcode
 */
exports.generateInternalBarcode = (productId, unitId) => {
  try {
    // Prefix for internal barcodes (22 = internal/private label)
    const prefix = "22";

    // Convert ObjectId hex to numeric value and extract 5 digits
    const productIdStr = productId.toString();
    const productNum = parseInt(productIdStr.slice(-8), 16); // Convert last 8 hex chars to number
    const productCode = (productNum % 100000).toString().padStart(5, "0");

    // Convert ObjectId hex to numeric value and extract 5 digits
    const unitIdStr = unitId.toString();
    const unitNum = parseInt(unitIdStr.slice(-8), 16); // Convert last 8 hex chars to number
    const unitCode = (unitNum % 100000).toString().padStart(5, "0");

    // Combine first 12 digits
    const barcode12 = prefix + productCode + unitCode;

    // Calculate check digit
    const checkDigit = calculateEAN13CheckDigit(barcode12);

    // Return complete 13-digit barcode
    return barcode12 + checkDigit;
  } catch (error) {
    throw error;
  }
};

/**
 * Validate barcode format (EAN-13, EAN-8, UPC-A, Code-128)
 * @param {String} barcode - Barcode to validate
 * @returns {Object} - { valid, format }
 */
exports.validateBarcodeFormat = (barcode) => {
  if (!barcode) {
    return { valid: true, format: "none" }; // Barcode is optional
  }

  // Remove whitespace
  const cleanBarcode = barcode.trim();

  // EAN-13 (13 digits) - Accept without strict check digit validation
  if (/^\d{13}$/.test(cleanBarcode)) {
    return { valid: true, format: "EAN-13" };
  }

  // EAN-8 (8 digits)
  if (/^\d{8}$/.test(cleanBarcode)) {
    return { valid: true, format: "EAN-8" };
  }

  // UPC-A (12 digits)
  if (/^\d{12}$/.test(cleanBarcode)) {
    return { valid: true, format: "UPC-A" };
  }

  // Code-128 (alphanumeric, length varies)
  if (/^[A-Z0-9\-\.]+$/i.test(cleanBarcode) && cleanBarcode.length >= 6) {
    return { valid: true, format: "Code-128" };
  }

  return { valid: false, format: "unknown" };
};

/**
 * Create new product unit
 * @param {Object} data - Product unit data
 * @returns {Object} - Created Product Unit
 */
exports.createProductUnit = async (data) => {
  try {
    const {
      product_id,
      unit_id,
      exchange_value,
      price,
      barcode,
      is_base_unit,
    } = data;

    // Validate required fields
    if (!product_id || !unit_id) {
      throw new Error("Mã sản phẩm và mã đơn vị là bắt buộc");
    }

    // Validate product exists
    const product = await Product.findById(product_id);
    if (!product) {
      throw new Error("Không tìm thấy sản phẩm");
    }

    // Validate unit exists
    const unit = await Unit.findById(unit_id);
    if (!unit) {
      throw new Error("Không tìm thấy đơn vị");
    }

    // Check if product + unit combination already exists
    const existingCombination = await ProductUnit.findOne({
      product_id,
      unit_id,
    });

    if (existingCombination) {
      throw new Error("Tổ hợp sản phẩm-đơn vị này đã tồn tại");
    }

    // Validate exchange value
    if (exchange_value === undefined || exchange_value <= 0) {
      throw new Error("Giá trị quy đổi phải lớn hơn 0");
    }

    // Validate price
    if (price === undefined || price < 0) {
      throw new Error("Giá không thể là số âm");
    }

    // Validate barcode format if provided
    if (barcode) {
      const validation = exports.validateBarcodeFormat(barcode);
      if (!validation.valid) {
        throw new Error(
          `Định dạng mã vạch không hợp lệ. Yêu cầu EAN-13, EAN-8, UPC-A hoặc Code-128`,
        );
      }

      // Check barcode uniqueness
      const existingBarcode = await ProductUnit.findOne({ barcode });
      if (existingBarcode) {
        throw new Error("Mã vạch đã tồn tại");
      }
    }

    // If setting as base unit, ensure no other base unit exists
    if (is_base_unit === true) {
      const existingBaseUnit = await ProductUnit.findOne({
        product_id,
        is_base_unit: true,
      });

      if (existingBaseUnit) {
        throw new Error(
          "Sản phẩm đã có đơn vị cơ sở. Vui lòng tắt đơn vị cơ sở hiện tại trước.",
        );
      }
    }

    // Create product unit
    const productUnit = new ProductUnit({
      product_id,
      unit_id,
      exchange_value,
      price,
      barcode: barcode || null,
      is_base_unit: is_base_unit || false,
    });

    await productUnit.save();

    // Populate and return
    const populatedUnit = await ProductUnit.findById(productUnit._id)
      .populate("product_id", "name image_url category_id is_active")
      .populate("unit_id", "name");

    return populatedUnit;
  } catch (error) {
    throw error;
  }
};

/**
 * Get statistics for product units
 * @returns {Object} - Statistics
 */
exports.getProductUnitStats = async () => {
  try {
    const total = await ProductUnit.countDocuments();
    const baseUnits = await ProductUnit.countDocuments({ is_base_unit: true });

    // Get products with multiple units
    const unitsPerProduct = await ProductUnit.aggregate([
      {
        $group: {
          _id: "$product_id",
          count: { $sum: 1 },
        },
      },
    ]);

    const productsWithUnits = unitsPerProduct.length;
    const productsWithMultipleUnits = unitsPerProduct.filter(
      (p) => p.count > 1,
    ).length;
    const avgUnitsPerProduct =
      productsWithUnits > 0 ? (total / productsWithUnits).toFixed(2) : 0;

    return {
      totalProductUnits: total,
      totalBaseUnits: baseUnits,
      productsWithUnits,
      productsWithMultipleUnits,
      avgUnitsPerProduct: parseFloat(avgUnitsPerProduct),
    };
  } catch (error) {
    throw error;
  }
};

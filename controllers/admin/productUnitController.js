const productUnitService = require("../../services/admin/productUnitService");

/**
 * Get all product units with filters and pagination
 * GET /api/v1/product-units
 * Query params: product_id, unit_id, is_base_unit, search, page, limit, sort_by, sort_order
 */
exports.getAll = async (req, res) => {
  try {
    const result = await productUnitService.getAllProductUnits(req.query);

    res.status(200).json({
      success: true,
      message: "Lấy danh sách đơn vị sản phẩm thành công",
      data: result.productUnits,
      pagination: {
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
        limit: result.limit,
      },
    });
  } catch (error) {
    console.error("Error in getAll:", error);
    res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách đơn vị sản phẩm",
      error: error.message,
    });
  }
};

/**
 * Get product unit by ID
 * GET /api/v1/product-units/:id
 */
exports.getById = async (req, res) => {
  try {
    const productUnit = await productUnitService.getProductUnitById(
      req.params.id,
    );

    res.status(200).json({
      success: true,
      message: "Lấy thông tin đơn vị sản phẩm thành công",
      data: productUnit,
    });
  } catch (error) {
    console.error("Error in getById:", error);
    const statusCode =
      error.message === "Không tìm thấy đơn vị sản phẩm" ? 404 : 500;

    res.status(statusCode).json({
      success: false,
      message: error.message,
      error: error.message,
    });
  }
};

/**
 * Get product units by product ID
 * GET /api/v1/product-units/product/:productId
 */
exports.getByProductId = async (req, res) => {
  try {
    const productUnits = await productUnitService.getProductUnitsByProductId(
      req.params.productId,
    );

    res.status(200).json({
      success: true,
      message: "Lấy danh sách đơn vị sản phẩm thành công",
      data: productUnits,
      count: productUnits.length,
    });
  } catch (error) {
    console.error("Error in getByProductId:", error);
    res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách đơn vị sản phẩm",
      error: error.message,
    });
  }
};

/**
 * Update product unit
 * PUT /api/v1/product-units/:id
 */
exports.update = async (req, res) => {
  try {
    const { exchange_value, price, barcode, is_base_unit } = req.body;

    // Validate input
    if (exchange_value !== undefined && exchange_value <= 0) {
      return res.status(400).json({
        success: false,
        message: "Giá trị quy đổi phải lớn hơn 0",
      });
    }

    if (price !== undefined && price < 0) {
      return res.status(400).json({
        success: false,
        message: "Giá không được là số âm",
      });
    }

    const productUnit = await productUnitService.updateProductUnit(
      req.params.id,
      req.body,
    );

    res.status(200).json({
      success: true,
      message: "Cập nhật đơn vị sản phẩm thành công",
      data: productUnit,
    });
  } catch (error) {
    console.error("Error in update:", error);
    const statusCode =
      error.message === "Không tìm thấy đơn vị sản phẩm" ? 404 : 400;

    res.status(statusCode).json({
      success: false,
      message: error.message,
      error: error.message,
    });
  }
};

/**
 * Delete product unit
 * DELETE /api/v1/product-units/:id
 */
exports.delete = async (req, res) => {
  try {
    const result = await productUnitService.deleteProductUnit(req.params.id);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error("Error in delete:", error);
    const statusCode =
      error.message === "Không tìm thấy đơn vị sản phẩm" ? 404 : 400;

    res.status(statusCode).json({
      success: false,
      message: error.message,
      error: error.message,
    });
  }
};

/**
 * Create new product unit
 * POST /api/v1/product-units
 */
exports.create = async (req, res) => {
  try {
    const productUnit = await productUnitService.createProductUnit(req.body);

    res.status(201).json({
      success: true,
      message: "Tạo đơn vị sản phẩm thành công",
      data: productUnit,
    });
  } catch (error) {
    console.error("Error in create:", error);
    const statusCode = error.message.includes("tìm thấy")
      ? 404
      : error.message.includes("tồn tại")
        ? 409
        : 400;

    res.status(statusCode).json({
      success: false,
      message: error.message,
      error: error.message,
    });
  }
};

/**
 * Generate internal barcode
 * POST /api/v1/product-units/generate-barcode
 */
exports.generateBarcode = async (req, res) => {
  try {
    const { product_id, unit_id } = req.body;

    if (!product_id) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn sản phẩm",
      });
    }

    if (!unit_id) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn đơn vị",
      });
    }

    const barcode = productUnitService.generateInternalBarcode(
      product_id,
      unit_id,
    );

    res.status(200).json({
      success: true,
      message: "Tạo mã vạch thành công",
      data: {
        barcode,
        format: "EAN-13",
        type: "internal",
      },
    });
  } catch (error) {
    console.error("Error in generateBarcode:", error);
    res.status(400).json({
      success: false,
      message: error.message,
      error: error.message,
    });
  }
};

/**
 * Validate barcode format
 * POST /api/v1/product-units/validate-barcode
 */
exports.validateBarcode = async (req, res) => {
  try {
    const { barcode } = req.body;

    if (!barcode) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập mã vạch",
      });
    }

    const validation = productUnitService.validateBarcodeFormat(barcode);

    res.status(200).json({
      success: true,
      message: validation.valid ? "Mã vạch hợp lệ" : "Mã vạch không hợp lệ",
      data: validation,
    });
  } catch (error) {
    console.error("Error in validateBarcode:", error);
    res.status(400).json({
      success: false,
      message: error.message,
      error: error.message,
    });
  }
};

/**
 * Get product unit statistics
 * GET /api/v1/product-units/stats/overview
 */
exports.getStats = async (req, res) => {
  try {
    const stats = await productUnitService.getProductUnitStats();

    res.status(200).json({
      success: true,
      message: "Lấy thống kê thành công",
      data: stats,
    });
  } catch (error) {
    console.error("Error in getStats:", error);
    res.status(500).json({
      success: false,
      message: "Không thể lấy thống kê",
      error: error.message,
    });
  }
};

// ============================================
// UNIT MANAGEMENT (merged from unitController)
// ============================================

/**
 * Get all units
 * GET /api/v1/product-units/units
 */
exports.getAllUnits = async (req, res) => {
  try {
    const Unit = require("../../models/admin/Unit");
    const units = await Unit.find().sort({ name: 1 });

    res.status(200).json({
      success: true,
      message: "Lấy danh sách đơn vị thành công",
      data: units,
    });
  } catch (error) {
    console.error("Error in getAllUnits:", error);
    res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách đơn vị",
      error: error.message,
    });
  }
};

/**
 * Get unit by ID
 * GET /api/v1/product-units/units/:id
 */
exports.getUnitById = async (req, res) => {
  try {
    const Unit = require("../../models/admin/Unit");
    const unit = await Unit.findById(req.params.id);

    if (!unit) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đơn vị",
      });
    }

    res.status(200).json({
      success: true,
      message: "Lấy thông tin đơn vị thành công",
      data: unit,
    });
  } catch (error) {
    console.error("Error in getUnitById:", error);
    res.status(500).json({
      success: false,
      message: "Không thể lấy thông tin đơn vị",
      error: error.message,
    });
  }
};

/**
 * Create new unit
 * POST /api/v1/product-units/units
 */
exports.createUnit = async (req, res) => {
  try {
    const Unit = require("../../models/admin/Unit");
    const { name } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập tên đơn vị",
      });
    }

    // Trim and validate unit name format
    const trimmedName = name.trim();

    // Only allow letters (including Vietnamese), numbers, and spaces (not at start/end)
    const nameRegex =
      /^[a-zA-Z0-9\u00C0-\u1EF9]+( [a-zA-Z0-9\u00C0-\u1EF9]+)*$/;

    if (!nameRegex.test(trimmedName)) {
      return res.status(400).json({
        success: false,
        message:
          "Tên đơn vị chỉ được chứa chữ, số và khoảng trắng (không kí tự đặc biệt)",
      });
    }

    // Check if unit name already exists (case-insensitive)
    const escapedName = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const existingUnit = await Unit.findOne({
      name: { $regex: `^${escapedName}$`, $options: "i" },
    });

    if (existingUnit) {
      return res.status(400).json({
        success: false,
        message: "Tên đơn vị đã tồn tại",
      });
    }

    // Create new unit
    const unit = await Unit.create({
      name: trimmedName,
    });

    res.status(201).json({
      success: true,
      message: "Tạo đơn vị thành công",
      data: unit,
    });
  } catch (error) {
    console.error("Error in createUnit:", error);
    res.status(500).json({
      success: false,
      message: "Không thể tạo đơn vị",
      error: error.message,
    });
  }
};

/**
 * Update unit
 * PUT /api/v1/product-units/units/:id
 */
exports.updateUnit = async (req, res) => {
  try {
    const Unit = require("../../models/admin/Unit");
    const { name } = req.body;
    const unitId = req.params.id;

    // Check if unit exists
    const unit = await Unit.findById(unitId);
    if (!unit) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đơn vị",
      });
    }

    // Check if new name already exists (excluding current unit, case-insensitive)
    if (name && name.trim().toLowerCase() !== unit.name.toLowerCase()) {
      const trimmedName = name.trim();

      // Only allow letters (including Vietnamese), numbers, and spaces (not at start/end)
      const nameRegex =
        /^[a-zA-Z0-9\u00C0-\u1EF9]+( [a-zA-Z0-9\u00C0-\u1EF9]+)*$/;
      if (!nameRegex.test(trimmedName)) {
        return res.status(400).json({
          success: false,
          message:
            "Tên đơn vị chỉ được chứa chữ, số và khoảng trắng (không kí tự đặc biệt)",
        });
      }

      const escapedName = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const existingUnit = await Unit.findOne({
        name: { $regex: `^${escapedName}$`, $options: "i" },
        _id: { $ne: unitId },
      });
      if (existingUnit) {
        return res.status(400).json({
          success: false,
          message: "Tên đơn vị đã tồn tại",
        });
      }
    }

    // Update unit
    if (name) unit.name = name.trim();
    await unit.save();

    res.status(200).json({
      success: true,
      message: "Cập nhật đơn vị thành công",
      data: unit,
    });
  } catch (error) {
    console.error("Error in updateUnit:", error);
    res.status(500).json({
      success: false,
      message: "Không thể cập nhật đơn vị",
      error: error.message,
    });
  }
};

/**
 * Delete unit
 * DELETE /api/v1/product-units/units/:id
 */
exports.deleteUnit = async (req, res) => {
  try {
    const Unit = require("../../models/admin/Unit");
    const unit = await Unit.findById(req.params.id);

    if (!unit) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đơn vị",
      });
    }

    // Check if unit is being used in product units
    const ProductUnit = require("../models/ProductUnit");
    const usageCount = await ProductUnit.countDocuments({ unit_id: unit._id });

    if (usageCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Không thể xóa đơn vị. Nó đang được sử dụng bởi ${usageCount} đơn vị sản phẩm.`,
      });
    }

    await Unit.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Xóa đơn vị thành công",
    });
  } catch (error) {
    console.error("Error in deleteUnit:", error);
    res.status(500).json({
      success: false,
      message: "Không thể xóa đơn vị",
      error: error.message,
    });
  }
};

const {
  CartItem,
  ProductUnit,
  Product,
  RecipeIngredient,
  Recipe,
  ProductBatch,
} = require("../../models");

class CartService {
  _isBatchItemSellable(batchItem, now = new Date()) {
    if (!batchItem) return false;
    if (batchItem.status !== "onsale") return false;
    if (Number(batchItem.current_quantity || 0) <= 0) return false;

    if (!batchItem.expiry_date) return true;
    const expiry = new Date(batchItem.expiry_date);
    if (Number.isNaN(expiry.getTime())) return true;

    return expiry >= now;
  }

  _getBatchItemExpiryTime(batchItem) {
    if (!batchItem?.expiry_date) return Number.MAX_SAFE_INTEGER;
    const time = new Date(batchItem.expiry_date).getTime();
    return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
  }

  _getBatchItemDiscountPercentage(batchItem) {
    if (
      batchItem?.rescue_pricing_enabled &&
      batchItem?.rescue_pricing_active &&
      Number(batchItem?.rescue_discount_percentage || 0) > 0
    ) {
      return Number(batchItem.rescue_discount_percentage);
    }

    if (
      !batchItem?.rescue_pricing_enabled &&
      Number(batchItem?.manual_discount_percentage || 0) > 0
    ) {
      return Number(batchItem.manual_discount_percentage);
    }

    return 0;
  }

  async _getSellableBatchCandidates(productId, unitId) {
    const batches = await ProductBatch.find({
      is_deleted: false,
      items: {
        $elemMatch: {
          product_id: productId,
          unit_id: unitId,
          status: "onsale",
          current_quantity: { $gt: 0 },
        },
      },
    }).lean();

    const candidates = [];

    for (const batch of batches) {
      for (const item of batch.items || []) {
        if (item.product_id.toString() !== productId.toString()) continue;
        if (item.unit_id.toString() !== unitId.toString()) continue;
        if (!this._isBatchItemSellable(item)) continue;

        candidates.push({
          product_batch_id: String(batch._id),
          batch_item_id: String(item._id),
          available_quantity: Number(item.current_quantity || 0),
          discount_percentage: this._getBatchItemDiscountPercentage(item),
          expiry_time: this._getBatchItemExpiryTime(item),
          created_at: new Date(batch.created_at).getTime(),
        });
      }
    }

    candidates.sort((a, b) => {
      if (a.expiry_time !== b.expiry_time) {
        return a.expiry_time - b.expiry_time;
      }
      return a.created_at - b.created_at;
    });

    return candidates;
  }

  async _buildPricingPreview(productUnit, quantity) {
    const qty = Number(quantity || 0);
    if (!qty || qty < 1) {
      throw new Error("Số lượng không hợp lệ");
    }

    const productId = productUnit?.product_id?._id || productUnit?.product_id;
    const unitId = productUnit?.unit_id?._id || productUnit?.unit_id;
    const originalUnitPrice = Math.round(Number(productUnit?.price || 0));
    const taxPercentage = Number(productUnit?.product_id?.tax_percentage || 0);

    const candidates = await this._getSellableBatchCandidates(
      productId,
      unitId,
    );
    const discountedStockBreakdownMap = new Map();
    let discountedAvailableQuantity = 0;

    for (const candidate of candidates) {
      if (candidate.discount_percentage > 0) {
        discountedAvailableQuantity += Number(
          candidate.available_quantity || 0,
        );
        const currentQty =
          Number(
            discountedStockBreakdownMap.get(candidate.discount_percentage) || 0,
          ) + Number(candidate.available_quantity || 0);
        discountedStockBreakdownMap.set(
          candidate.discount_percentage,
          currentQty,
        );
      }
    }

    const allocations = [];
    let remaining = qty;

    for (const candidate of candidates) {
      if (remaining <= 0) break;

      const take = Math.min(
        remaining,
        Number(candidate.available_quantity || 0),
      );
      if (take <= 0) continue;

      const discountPercentage = Number(candidate.discount_percentage || 0);
      const discountedUnitPrice = Math.round(
        originalUnitPrice - (originalUnitPrice * discountPercentage) / 100,
      );

      allocations.push({
        product_batch_id: candidate.product_batch_id,
        batch_item_id: candidate.batch_item_id,
        quantity: take,
        original_unit_price: originalUnitPrice,
        unit_price: discountedUnitPrice,
        discount_percentage: discountPercentage,
        is_discounted: discountPercentage > 0,
        line_subtotal: Math.round(take * discountedUnitPrice),
      });

      remaining -= take;
    }

    if (remaining > 0) {
      throw new Error(
        `Sản phẩm không đủ tồn kho trong lô bán (thiếu ${remaining} sản phẩm)`,
      );
    }

    const lineOriginalSubtotal = Math.round(originalUnitPrice * qty);
    const lineSubtotal = allocations.reduce(
      (sum, item) => sum + Number(item.line_subtotal || 0),
      0,
    );
    const lineSavings = Math.max(0, lineOriginalSubtotal - lineSubtotal);
    const lineTaxAmount = Math.round((lineSubtotal * taxPercentage) / 100);
    const discountedQuantity = allocations.reduce(
      (sum, item) =>
        sum + (item.is_discounted ? Number(item.quantity || 0) : 0),
      0,
    );
    const displayDiscountPercentage = Number(
      allocations[0]?.discount_percentage || 0,
    );

    const discountedStockBreakdown = Array.from(
      discountedStockBreakdownMap.entries(),
    )
      .map(([discount_percentage, quantityValue]) => ({
        discount_percentage: Number(discount_percentage),
        quantity: Number(quantityValue || 0),
      }))
      .sort((a, b) => b.discount_percentage - a.discount_percentage);

    return {
      allocations,
      original_unit_price: originalUnitPrice,
      display_discount_percentage: displayDiscountPercentage,
      discounted_quantity: discountedQuantity,
      regular_quantity: qty - discountedQuantity,
      line_original_subtotal: lineOriginalSubtotal,
      line_subtotal: lineSubtotal,
      line_savings: lineSavings,
      line_tax_amount: lineTaxAmount,
      line_total_with_tax: lineSubtotal + lineTaxAmount,
      discounted_available_quantity: discountedAvailableQuantity,
      discounted_stock_breakdown: discountedStockBreakdown,
      available_quantity: candidates.reduce(
        (sum, item) => sum + Number(item.available_quantity || 0),
        0,
      ),
    };
  }

  async findNearestSellableBatchItem(productId, unitId, minQuantity = 1) {
    const batches = await ProductBatch.find({
      is_deleted: false,
      items: {
        $elemMatch: {
          product_id: productId,
          unit_id: unitId,
          status: "onsale",
          current_quantity: { $gte: minQuantity },
        },
      },
    }).lean();

    const candidates = [];

    for (const batch of batches) {
      for (const item of batch.items || []) {
        if (item.product_id.toString() !== productId.toString()) continue;
        if (item.unit_id.toString() !== unitId.toString()) continue;
        if (!this._isBatchItemSellable(item)) continue;
        if (Number(item.current_quantity || 0) < Number(minQuantity || 1)) {
          continue;
        }

        candidates.push({
          batch,
          batchItem: item,
          expiryTime: this._getBatchItemExpiryTime(item),
        });
      }
    }

    if (!candidates.length) {
      return null;
    }

    candidates.sort((a, b) => {
      if (a.expiryTime !== b.expiryTime) {
        return a.expiryTime - b.expiryTime;
      }
      return (
        new Date(a.batch.created_at).getTime() -
        new Date(b.batch.created_at).getTime()
      );
    });

    return candidates[0];
  }

  async getAvailableBatchQuantity(productId, unitId) {
    const candidates = await this._getSellableBatchCandidates(
      productId,
      unitId,
    );
    return candidates.reduce(
      (sum, item) => sum + Number(item.available_quantity || 0),
      0,
    );
  }

  /**
   * Add item to cart
   */
  async addToCart(userId, productUnitId, quantity) {
    if (quantity <= 0) {
      throw new Error("Số lượng phải lớn hơn 0");
    }

    // Check if product unit exists
    const productUnit = await ProductUnit.findById(productUnitId);
    if (!productUnit) {
      throw new Error("Sản phẩm không tồn tại");
    }

    // Check if already in cart
    let cartItem = await CartItem.findOne({
      user_id: userId,
      product_unit_id: productUnitId,
    });

    const currentCartQuantity = cartItem ? cartItem.quantity : 0;
    const nextQuantity = currentCartQuantity + quantity;
    const availableBatchQuantity = await this.getAvailableBatchQuantity(
      productUnit.product_id,
      productUnit.unit_id,
    );

    if (availableBatchQuantity < nextQuantity) {
      throw new Error(
        `Sản phẩm không đủ tồn kho trong lô bán (còn ${availableBatchQuantity}, yêu cầu ${nextQuantity})`,
      );
    }

    if (cartItem) {
      // Update quantity
      cartItem.quantity += quantity;
      await cartItem.save();
    } else {
      // Add new item
      cartItem = new CartItem({
        user_id: userId,
        product_unit_id: productUnitId,
        quantity,
      });
      await cartItem.save();
    }

    return cartItem;
  }

  /**
   * Get user cart
   */
  async getCart(userId) {
    const cartItems = await CartItem.find({ user_id: userId })
      .populate({
        path: "product_unit_id",
        populate: [
          {
            path: "product_id",
            populate: { path: "category_id" },
          },
          { path: "unit_id" },
        ],
      })
      .sort({ createdAt: -1 });

    // Enhance cart items with FEFO mixed pricing info.
    const enhancedItems = await Promise.all(
      cartItems.map(async (item) => {
        const productUnit = item.product_unit_id;
        const product = productUnit?.product_id;
        const unit = productUnit?.unit_id;

        let rescuePricing = {
          isAvailable: false,
          originalPrice: productUnit?.price || 0,
          discountPercentage: 0,
          discountedPrice: productUnit?.price || 0,
          savings: 0,
        };

        let pricingDetail = {
          allocations: [],
          original_unit_price: productUnit?.price || 0,
          display_discount_percentage: 0,
          discounted_quantity: 0,
          regular_quantity: item.quantity || 0,
          line_original_subtotal:
            (productUnit?.price || 0) * (item.quantity || 0),
          line_subtotal: (productUnit?.price || 0) * (item.quantity || 0),
          line_savings: 0,
          line_tax_amount: Math.round(
            ((productUnit?.price || 0) *
              (item.quantity || 0) *
              Number(product?.tax_percentage || 0)) /
              100,
          ),
          line_total_with_tax: 0,
          discounted_available_quantity: 0,
          discounted_stock_breakdown: [],
          available_quantity: 0,
        };
        pricingDetail.line_total_with_tax =
          pricingDetail.line_subtotal + pricingDetail.line_tax_amount;

        // Build FEFO pricing preview by current cart quantity.
        if (product && unit) {
          try {
            pricingDetail = await this._buildPricingPreview(
              productUnit,
              item.quantity,
            );

            if (pricingDetail.discounted_quantity > 0) {
              const discountedUnitPrice =
                pricingDetail.allocations.find((part) => part.is_discounted)
                  ?.unit_price || productUnit.price;
              rescuePricing = {
                isAvailable: true,
                originalPrice: pricingDetail.original_unit_price,
                discountPercentage: pricingDetail.display_discount_percentage,
                discountedPrice: discountedUnitPrice,
                savings: pricingDetail.line_savings,
              };
            }
          } catch (previewError) {
            pricingDetail.available_quantity =
              await this.getAvailableBatchQuantity(product._id, unit._id);
            pricingDetail.error_message =
              previewError.message || "Tồn kho đã thay đổi";
          }
        }

        return {
          ...item.toObject(),
          // Add quick access fields for mobile easy rendering
          product,
          productUnit,
          unit,
          rescuePricing,
          pricing_detail: pricingDetail,
        };
      }),
    );

    return enhancedItems;
  }

  /**
   * Update cart item quantity
   */
  async updateQuantity(userId, cartItemId, quantity) {
    if (quantity <= 0) {
      return this.removeFromCart(userId, cartItemId);
    }

    const existingItem = await CartItem.findOne({
      _id: cartItemId,
      user_id: userId,
    }).populate("product_unit_id");

    if (!existingItem) {
      throw new Error("Không tìm thấy sản phẩm trong giỏ");
    }

    const availableBatchQuantity = await this.getAvailableBatchQuantity(
      existingItem.product_unit_id.product_id,
      existingItem.product_unit_id.unit_id,
    );

    if (availableBatchQuantity < quantity) {
      throw new Error(
        `Sản phẩm không đủ tồn kho trong lô bán (còn ${availableBatchQuantity}, yêu cầu ${quantity})`,
      );
    }

    const cartItem = await CartItem.findOneAndUpdate(
      { _id: cartItemId, user_id: userId },
      { quantity },
      { new: true },
    );

    if (!cartItem) {
      throw new Error("Không tìm thấy sản phẩm trong giỏ");
    }

    return cartItem;
  }

  /**
   * Remove item from cart
   */
  async removeFromCart(userId, cartItemId) {
    const result = await CartItem.findOneAndDelete({
      _id: cartItemId,
      user_id: userId,
    });

    if (!result) {
      throw new Error("Không tìm thấy sản phẩm trong giỏ");
    }

    return result;
  }

  /**
   * Add recipe ingredients to cart
   */
  async addRecipeToCart(userId, recipeId) {
    // Check if recipe exists
    const recipe = await Recipe.findById(recipeId);
    if (!recipe) {
      throw new Error("Công thức không tồn tại");
    }

    // Get all ingredients for the recipe
    const ingredients = await RecipeIngredient.find({ recipe_id: recipeId })
      .populate("product_id")
      .lean();

    if (!ingredients || ingredients.length === 0) {
      throw new Error("Công thức này không có nguyên liệu");
    }

    const addedItems = [];
    const errors = [];

    // Add each ingredient to cart
    for (const ingredient of ingredients) {
      try {
        if (!ingredient.product_id) {
          errors.push({
            message: `Sản phẩm không tồn tại`,
            ingredient_id: ingredient._id,
          });
          continue;
        }

        // Check stock availability
        const product = ingredient.product_id;
        const quantity = ingredient.quantity_needed || 1;

        if (!product.total_stock || product.total_stock <= 0) {
          errors.push({
            message: `Sản phẩm ${product.name} hiện đã hết hàng`,
            product_id: product._id,
            product_name: product.name,
          });
          continue;
        }

        // Find base unit or first active unit for the product
        const productUnit = await ProductUnit.findOne({
          product_id: product._id,
          is_active: true,
          $or: [{ is_base_unit: true }, { is_base_unit: { $exists: true } }],
        }).sort({ is_base_unit: -1, price: 1 });

        if (!productUnit) {
          errors.push({
            message: `Không tìm thấy đơn vị bán cho sản phẩm ${product.name}`,
            product_id: product._id,
            product_name: product.name,
          });
          continue;
        }

        // Add to cart
        const cartItem = await this.addToCart(
          userId,
          productUnit._id,
          quantity,
        );

        addedItems.push({
          product_name: product.name,
          quantity,
          cartItem,
        });
      } catch (error) {
        errors.push({
          message: error.message,
          product_name: ingredient.product_id?.name,
        });
      }
    }

    if (addedItems.length === 0) {
      return {
        success: false,
        message: "Không thể thêm nguyên liệu vào giỏ hàng",
        addedItems: [],
        errors:
          errors.length > 0
            ? errors
            : [{ message: "Không có nguyên liệu hợp lệ để thêm" }],
      };
    }

    return {
      success: true,
      message:
        errors.length > 0
          ? `Đã thêm ${addedItems.length} nguyên liệu, ${errors.length} nguyên liệu không thể thêm`
          : `Đã thêm ${addedItems.length} nguyên liệu vào giỏ hàng`,
      addedItems,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Clear user cart
   */
  async clearCart(userId) {
    return await CartItem.deleteMany({ user_id: userId });
  }
}

module.exports = new CartService();

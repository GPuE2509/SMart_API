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
    }).select("items");

    return batches.reduce((sum, batch) => {
      const batchItemQuantity = batch.items
        .filter(
          (item) =>
            item.product_id.toString() === productId.toString() &&
            item.unit_id.toString() === unitId.toString() &&
            this._isBatchItemSellable(item),
        )
        .reduce((itemSum, item) => itemSum + item.current_quantity, 0);

      return sum + batchItemQuantity;
    }, 0);
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

    // Enhance cart items with rescue pricing info
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

        // Find available batch and apply active discount policy (rescue or manual)
        if (product && unit) {
          const allocation = await this.findNearestSellableBatchItem(
            product._id,
            unit._id,
            item.quantity,
          );

          if (allocation) {
            const batchItem = allocation.batchItem;

            if (batchItem) {
              let discountPercentage = 0;

              if (
                batchItem.rescue_pricing_enabled &&
                batchItem.rescue_pricing_active &&
                batchItem.rescue_discount_percentage > 0
              ) {
                discountPercentage = batchItem.rescue_discount_percentage;
              } else if (
                !batchItem.rescue_pricing_enabled &&
                batchItem.manual_discount_percentage > 0
              ) {
                discountPercentage = batchItem.manual_discount_percentage;
              }

              const originalPrice = productUnit.price;
              if (discountPercentage > 0) {
                const discountedPrice = Math.round(
                  (originalPrice * (100 - discountPercentage)) / 100,
                );
                const savingsPerUnit = originalPrice - discountedPrice;

                rescuePricing = {
                  isAvailable: true,
                  originalPrice: originalPrice,
                  discountPercentage,
                  discountedPrice: discountedPrice,
                  savings: savingsPerUnit * item.quantity,
                };
              }
            }
          }
        }

        return {
          ...item.toObject(),
          // Add quick access fields for mobile easy rendering
          product,
          productUnit,
          unit,
          rescuePricing,
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

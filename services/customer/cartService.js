const { CartItem, ProductUnit, Product, RecipeIngredient, Recipe } = require("../../models");

class CartService {
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

    // Format response
    return cartItems.map((item) => ({
      ...item.toObject(),
      // Add quick access fields for mobile easy rendering
      product: item.product_unit_id.product_id,
      productUnit: item.product_unit_id,
      unit: item.product_unit_id.unit_id,
    }));
  }

  /**
   * Update cart item quantity
   */
  async updateQuantity(userId, cartItemId, quantity) {
    if (quantity <= 0) {
      return this.removeFromCart(userId, cartItemId);
    }

    const cartItem = await CartItem.findOneAndUpdate(
      { _id: cartItemId, user_id: userId },
      { quantity },
      { new: true }
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

        // Find base unit or first active unit for the product
        const productUnit = await ProductUnit.findOne({
          product_id: ingredient.product_id._id,
          is_active: true,
          $or: [{ is_base_unit: true }, { is_base_unit: { $exists: true } }],
        }).sort({ is_base_unit: -1, price: 1 });

        if (!productUnit) {
          errors.push({
            message: `Không tìm thấy đơn vị bán cho sản phẩm ${ingredient.product_id.name}`,
            product_id: ingredient.product_id._id,
            product_name: ingredient.product_id.name,
          });
          continue;
        }

        // Add to cart
        const quantity = ingredient.quantity_needed || 1;
        const cartItem = await this.addToCart(
          userId,
          productUnit._id,
          quantity
        );
        
        addedItems.push({
          product_name: ingredient.product_id.name,
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

    return {
      success: true,
      message: `Đã thêm ${addedItems.length} nguyên liệu vào giỏ hàng`,
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

const { CartItem, ProductUnit, Product } = require("../../models");

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
   * Clear user cart
   */
  async clearCart(userId) {
    return await CartItem.deleteMany({ user_id: userId });
  }
}

module.exports = new CartService();

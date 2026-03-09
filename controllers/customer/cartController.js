const cartService = require("../../services/customer/cartService");

class CartController {
  async getCart(req, res) {
    try {
      const userId = req.user.id;
      const cartItems = await cartService.getCart(userId);

      res.status(200).json({
        success: true,
        data: cartItems,
      });
    } catch (error) {
      console.error("Get cart error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Không thể lấy giỏ hàng",
      });
    }
  }

  async addToCart(req, res) {
    try {
      const userId = req.user.id;
      const { productUnitId, quantity = 1 } = req.body;

      if (!productUnitId) {
        return res.status(400).json({
          success: false,
          message: "Vui lòng chọn sản phẩm",
        });
      }

      const cartItem = await cartService.addToCart(
        userId,
        productUnitId,
        quantity
      );

      res.status(200).json({
        success: true,
        message: "Đã thêm vào giỏ hàng",
        data: cartItem,
      });
    } catch (error) {
      console.error("Add to cart error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Thêm vào giỏ hàng thất bại",
      });
    }
  }

  async updateQuantity(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { quantity } = req.body;

      if (quantity === undefined) {
        return res.status(400).json({
          success: false,
          message: "Vui lòng nhập số lượng",
        });
      }

      await cartService.updateQuantity(userId, id, quantity);

      res.status(200).json({
        success: true,
        message: "Cập nhật số lượng thành công",
      });
    } catch (error) {
      console.error("Update cart quantity error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Cập nhật thất bại",
      });
    }
  }

  async removeFromCart(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      await cartService.removeFromCart(userId, id);

      res.status(200).json({
        success: true,
        message: "Đã xóa khỏi giỏ hàng",
      });
    } catch (error) {
      console.error("Remove from cart error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Xóa thất bại",
      });
    }
  }

  async addRecipeToCart(req, res) {
    try {
      const userId = req.user.id;
      const { recipeId } = req.body;

      if (!recipeId) {
        return res.status(400).json({
          success: false,
          message: "Vui lòng chọn công thức",
        });
      }

      const result = await cartService.addRecipeToCart(userId, recipeId);

      res.status(200).json(result);
    } catch (error) {
      console.error("Add recipe to cart error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Thêm nguyên liệu vào giỏ hàng thất bại",
      });
    }
  }

  async clearCart(req, res) {
    try {
      const userId = req.user.id;
      
      await cartService.clearCart(userId);

      res.status(200).json({
        success: true,
        message: "Đã dọn sạch giỏ hàng",
      });
    } catch (error) {
      console.error("Clear cart error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Dọn giỏ hàng thất bại",
      });
    }
  }
}

module.exports = new CartController();

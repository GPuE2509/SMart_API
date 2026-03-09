const express = require("express");
const router = express.Router();
const cartController = require("../../controllers/customer/cartController");
const { authenticateUser } = require("../../middleware/authMiddleware");

// All cart routes require authentication
router.use(authenticateUser);

router.get("/", cartController.getCart);
router.post("/add", cartController.addToCart);
router.post("/add-recipe", cartController.addRecipeToCart);
router.put("/update/:id", cartController.updateQuantity);
router.delete("/remove/:id", cartController.removeFromCart);
router.delete("/clear", cartController.clearCart);

module.exports = router;

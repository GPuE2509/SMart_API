const express = require("express");
const router = express.Router();
const recipeController = require("../../controllers/customer/recipeController");

/**
 * Customer Recipe Routes
 * Base path: /api/v1/customer/recipes
 * No authentication required for browsing
 */

// Get all recipes (catalog)
router.get("/", recipeController.getAll);

// Get recipe detail by ID
router.get("/:id", recipeController.getById);

module.exports = router;


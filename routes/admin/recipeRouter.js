const express = require("express");
const router = express.Router();
const recipeController = require("../../controllers/admin/recipeController");
const {
  authenticateUser,
  authorizeRoles,
} = require("../../middleware/authMiddleware");

/**
 * @route   GET /api/v1/recipes/search
 * @desc    Search/filter recipes
 * @access  Admin only
 * @query   search, ingredient_id, min_ingredients, max_ingredients, page, limit
 */
router.get(
  "/search",
  authenticateUser,
  authorizeRoles("admin"),
  recipeController.search,
);

/**
 * @route   GET /api/v1/recipes
 * @desc    Get all recipes with pagination
 * @access  Admin only
 * @query   search, page, limit, sort_by
 */
router.get(
  "/",
  authenticateUser,
  authorizeRoles("admin"),
  recipeController.getAll,
);

/**
 * @route   GET /api/v1/recipes/:id
 * @desc    Get recipe by ID with ingredients
 * @access  Admin only
 */
router.get(
  "/:id",
  authenticateUser,
  authorizeRoles("admin"),
  recipeController.getById,
);

/**
 * @route   POST /api/v1/recipes
 * @desc    Create new recipe
 * @access  Admin only
 * @body    { title, description, instruction, image_url, ingredients }
 */
router.post(
  "/",
  authenticateUser,
  authorizeRoles("admin"),
  recipeController.create,
);

/**
 * @route   PUT /api/v1/recipes/:id
 * @desc    Update recipe
 * @access  Admin only
 * @body    { title, description, instruction, image_url, ingredients }
 */
router.put(
  "/:id",
  authenticateUser,
  authorizeRoles("admin"),
  recipeController.update,
);

/**
 * @route   DELETE /api/v1/recipes/:id
 * @desc    Delete recipe
 * @access  Admin only
 */
router.delete(
  "/:id",
  authenticateUser,
  authorizeRoles("admin"),
  recipeController.delete,
);

/**
 * @route   PATCH /api/v1/recipes/:id/toggle-status
 * @desc    Toggle recipe active status
 * @access  Admin only
 */
router.patch(
  "/:id/toggle-status",
  authenticateUser,
  authorizeRoles("admin"),
  recipeController.toggleStatus,
);

module.exports = router;

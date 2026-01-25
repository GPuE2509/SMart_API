const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/categoryController");

/**
 * Category Management Routes
 * Base path: /api/v1/categories
 */

// Get category tree (hierarchical structure) - must be before /:id
// GET /api/v1/categories/tree
router.get("/tree", categoryController.getTree);

// Get all categories with filters, search, and pagination
// GET /api/v1/categories?search=xxx&parent_id=xxx&sort_by=name&sort_order=asc&page=1&limit=20
router.get("/", categoryController.getAll);

// Get category by ID
// GET /api/v1/categories/:id
router.get("/:id", categoryController.getById);

// Create new category
// POST /api/v1/categories/create
router.post("/create", categoryController.create);

// Update category
// PUT /api/v1/categories/:id
router.put("/:id", categoryController.update);

// Delete category
// DELETE /api/v1/categories/:id
router.delete("/:id", categoryController.delete);

module.exports = router;

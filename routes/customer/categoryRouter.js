const express = require("express");
const router = express.Router();
const categoryController = require("../../controllers/customer/categoryController");

/**
 * Customer Category Routes
 * Base path: /api/v1/customer/categories
 * No authentication required for browsing
 */

// Get category tree (must be before /:id)
router.get("/tree/all", categoryController.getTree);

// Get all categories
router.get("/", categoryController.getAll);

// Get category by ID
router.get("/:id", categoryController.getById);

module.exports = router;

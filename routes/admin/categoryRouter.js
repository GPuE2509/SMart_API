const express = require("express");
const router = express.Router();
const categoryController = require("../../controllers/admin/categoryController");
const { authenticateUser, authorizeRoles } = require('../../middleware/authMiddleware');

router.get("/tree",authenticateUser, authorizeRoles('admin'), categoryController.getTree);

router.get("/", authenticateUser, authorizeRoles('admin'), categoryController.getAll);

router.get("/:id", authenticateUser, authorizeRoles('admin'), categoryController.getById);

router.post("/create", authenticateUser, authorizeRoles('admin'), categoryController.create);

router.put("/:id", authenticateUser, authorizeRoles('admin'), categoryController.update);

router.delete("/:id", authenticateUser, authorizeRoles('admin'), categoryController.delete);
module.exports = router;

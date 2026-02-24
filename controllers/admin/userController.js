const userService = require("../../services/admin/userService");

/**
 * Get current user profile
 * GET /api/v1/users/profile/me
 */
exports.getMyProfile = async (req, res) => {
  try {
    const user = await userService.getUserById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tài khoản",
      });
    }

    res.status(200).json({
      success: true,
      message: "Lấy thông tin profile thành công",
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Không thể lấy thông tin profile",
      error: error.message,
    });
  }
};

/**
 * Update current user profile
 * PUT /api/v1/users/profile/me
 */
exports.updateMyProfile = async (req, res) => {
  try {
    // Prevent users from updating sensitive fields
    const { role, status, loyalty_points, isVerified, ...profileData } =
      req.body;

    const user = await userService.updateUser(req.user._id, profileData);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tài khoản",
      });
    }

    res.status(200).json({
      success: true,
      message: "Cập nhật profile thành công",
      data: user,
    });
  } catch (error) {
    // Handle validation errors
    const validationErrors = [
      "Email đã được sử dụng bởi tài khoản khác",
      "Số điện thoại đã được sử dụng bởi tài khoản khác",
    ];

    if (validationErrors.some((msg) => error.message.includes(msg))) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Không thể cập nhật profile",
      error: error.message,
    });
  }
};

/**
 * Get all users with filters, search, and pagination
 * GET /api/v1/users
 * Query params: search, role, status, sort_by, sort_order, page, limit
 */
exports.getAll = async (req, res) => {
  try {
    const result = await userService.getAllUsers(req.query);

    res.status(200).json({
      success: true,
      message: "Lấy danh sách tài khoản thành công",
      data: result.users,
      pagination: result.pagination,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách tài khoản",
      error: error.message,
    });
  }
};

/**
 * Get user by ID
 * GET /api/v1/users/:id
 */
exports.getById = async (req, res) => {
  try {
    const user = await userService.getUserById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tài khoản",
      });
    }

    res.status(200).json({
      success: true,
      message: "Lấy thông tin tài khoản thành công",
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Không thể lấy thông tin tài khoản",
      error: error.message,
    });
  }
};

/**
 * Update user information
 * PUT /api/v1/users/:id
 * Body: full_name, email, phone, role, avatar_url, loyalty_points
 */
exports.update = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await userService.updateUser(id, req.body);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tài khoản",
      });
    }

    res.status(200).json({
      success: true,
      message: "Cập nhật tài khoản thành công",
      data: user,
    });
  } catch (error) {
    // Handle validation errors
    const validationErrors = [
      "Email đã được sử dụng bởi tài khoản khác",
      "Số điện thoại đã được sử dụng bởi tài khoản khác",
    ];

    if (validationErrors.some((msg) => error.message.includes(msg))) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Không thể cập nhật tài khoản",
      error: error.message,
    });
  }
};

/**
 * Update user status (block/unblock)
 * PUT /api/v1/users/:id/status
 * Body: status ('active' or 'blocked')
 */
exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Trạng thái là bắt buộc",
      });
    }

    const user = await userService.updateUserStatus(id, status);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tài khoản",
      });
    }

    res.status(200).json({
      success: true,
      message: `Đã ${status === "blocked" ? "khóa" : "mở khóa"} tài khoản thành công`,
      data: user,
    });
  } catch (error) {
    // Handle validation errors
    const validationErrors = [
      "Trạng thái không hợp lệ",
      "Không thể khóa tài khoản quản trị viên",
    ];

    if (validationErrors.some((msg) => error.message.includes(msg))) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Không thể cập nhật trạng thái tài khoản",
      error: error.message,
    });
  }
};

/**
 * Update user role
 * PUT /api/v1/users/:id/role
 * Body: role ('admin', 'seller_staff', 'repository_staff', 'customer')
 */
exports.updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role) {
      return res.status(400).json({
        success: false,
        message: "Vai trò là bắt buộc",
      });
    }

    const user = await userService.updateUserRole(id, role);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tài khoản",
      });
    }

    res.status(200).json({
      success: true,
      message: "Cập nhật vai trò thành công",
      data: user,
    });
  } catch (error) {
    // Handle validation errors
    const validationErrors = [
      "Vai trò không hợp lệ",
      "Không thể thay đổi vai trò của tài khoản quản trị viên",
    ];

    if (validationErrors.some((msg) => error.message.includes(msg))) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Không thể cập nhật vai trò tài khoản",
      error: error.message,
    });
  }
};

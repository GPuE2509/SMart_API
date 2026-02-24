const User = require("../../models/User");

/**
 * Helper function to remove Vietnamese diacritics
 * Converts: "Nguyễn Văn A" -> "nguyen van a"
 */
const removeVietnameseDiacritics = (str) => {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
};

/**
 * Get all users with filters, search, and pagination
 * @param {Object} filters - { search, role, status, sort_by, sort_order, page, limit }
 * @returns {Object} - { users, pagination }
 */
exports.getAllUsers = async (filters) => {
  const {
    search,
    role,
    status,
    sort_by = "created_at",
    sort_order = "desc",
    page = 1,
    limit = 20,
  } = filters;

  // Build query
  let query = {};

  // Filter by role
  if (role && role !== "all") {
    query.role = role;
  }

  // Filter by status
  if (status && status !== "all") {
    query.status = status;
  }

  // Get all users matching base filters
  let users = await User.find(query)
    .select(
      "-password -otp -otpExpiry -loginToken -loginTokenExpiry -loginSessionId",
    )
    .lean();

  // Search by name or email (case-insensitive and diacritics-insensitive)
  if (search) {
    const searchNormalized = removeVietnameseDiacritics(search);
    users = users.filter((u) => {
      const nameNormalized = removeVietnameseDiacritics(u.full_name || "");
      const emailNormalized = removeVietnameseDiacritics(u.email || "");
      return (
        nameNormalized.includes(searchNormalized) ||
        emailNormalized.includes(searchNormalized)
      );
    });
  }

  // Sort users
  const sortMultiplier = sort_order === "desc" ? -1 : 1;
  switch (sort_by) {
    case "full_name":
    case "name":
      users.sort(
        (a, b) =>
          sortMultiplier * (a.full_name || "").localeCompare(b.full_name || ""),
      );
      break;
    case "email":
      users.sort(
        (a, b) => sortMultiplier * (a.email || "").localeCompare(b.email || ""),
      );
      break;
    case "created_at":
    case "createdAt":
      users.sort(
        (a, b) =>
          sortMultiplier * (new Date(a.created_at) - new Date(b.created_at)),
      );
      break;
    case "updated_at":
    case "updatedAt":
      users.sort(
        (a, b) =>
          sortMultiplier * (new Date(a.updated_at) - new Date(b.updated_at)),
      );
      break;
    default:
      users.sort(
        (a, b) =>
          sortMultiplier * (new Date(b.created_at) - new Date(a.created_at)),
      );
  }

  // Pagination
  const total = users.length;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;
  const paginatedUsers = users.slice(skip, skip + limitNum);

  return {
    users: paginatedUsers,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  };
};

/**
 * Get user by ID
 * @param {String} id - User ID
 * @returns {Object} - User details
 */
exports.getUserById = async (id) => {
  const user = await User.findById(id)
    .select(
      "-password -otp -otpExpiry -loginToken -loginTokenExpiry -loginSessionId",
    )
    .lean();

  if (!user) {
    return null;
  }

  return user;
};

/**
 * Update user information
 * @param {String} id - User ID
 * @param {Object} userData - { full_name, email, phone, role, avatar_url }
 * @returns {Object} - Updated user
 */
exports.updateUser = async (id, userData) => {
  const user = await User.findById(id);

  if (!user) {
    return null;
  }

  // Check if email already exists (if changing email)
  if (userData.email && userData.email !== user.email) {
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      throw new Error("Email đã được sử dụng bởi tài khoản khác");
    }
  }

  // Check if phone already exists (if changing phone)
  if (userData.phone && userData.phone !== user.phone) {
    const existingUser = await User.findOne({ phone: userData.phone });
    if (existingUser) {
      throw new Error("Số điện thoại đã được sử dụng bởi tài khoản khác");
    }
  }

  // Update fields
  const allowedFields = ["full_name", "email", "phone", "role", "avatar_url"];

  allowedFields.forEach((field) => {
    if (userData[field] !== undefined) {
      user[field] = userData[field];
    }
  });

  await user.save();

  // Return user without sensitive fields
  const updatedUser = user.toObject();
  delete updatedUser.password;
  delete updatedUser.otp;
  delete updatedUser.otpExpiry;
  delete updatedUser.loginToken;
  delete updatedUser.loginTokenExpiry;
  delete updatedUser.loginSessionId;

  return updatedUser;
};

/**
 * Update user status (block/unblock)
 * @param {String} id - User ID
 * @param {String} status - 'active' or 'blocked'
 * @returns {Object} - Updated user
 */
exports.updateUserStatus = async (id, status) => {
  const user = await User.findById(id);

  if (!user) {
    return null;
  }

  // Không cho phép khóa tài khoản admin
  if (user.role === "admin") {
    throw new Error("Không thể khóa tài khoản quản trị viên");
  }

  // Validate status
  if (!["active", "blocked"].includes(status)) {
    throw new Error("Trạng thái không hợp lệ");
  }

  user.status = status;
  await user.save();

  // Return user without sensitive fields
  const updatedUser = user.toObject();
  delete updatedUser.password;
  delete updatedUser.otp;
  delete updatedUser.otpExpiry;
  delete updatedUser.loginToken;
  delete updatedUser.loginTokenExpiry;
  delete updatedUser.loginSessionId;

  return updatedUser;
};

/**
 * Update user role
 * @param {String} id - User ID
 * @param {String} role - 'admin', 'seller_staff', 'repository_staff', 'customer'
 * @returns {Object} - Updated user
 */
exports.updateUserRole = async (id, role) => {
  const user = await User.findById(id);

  if (!user) {
    return null;
  }

  // Không cho phép thay đổi vai trò của admin
  if (user.role === "admin") {
    throw new Error("Không thể thay đổi vai trò của tài khoản quản trị viên");
  }

  // Validate role
  const validRoles = ["admin", "seller_staff", "repository_staff", "customer"];
  if (!validRoles.includes(role)) {
    throw new Error("Vai trò không hợp lệ");
  }

  user.role = role;
  await user.save();

  // Return user without sensitive fields
  const updatedUser = user.toObject();
  delete updatedUser.password;
  delete updatedUser.otp;
  delete updatedUser.otpExpiry;
  delete updatedUser.loginToken;
  delete updatedUser.loginTokenExpiry;
  delete updatedUser.loginSessionId;

  return updatedUser;
};

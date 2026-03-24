const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      auto: true,
    },
    full_name: {
      type: String,
      maxlength: 255,
    },
    email: {
      type: String,
      maxlength: 255,
      unique: true,
      sparse: true,
    },
    phone: {
      type: String,
      maxlength: 20,
      unique: true,
      sparse: true,
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    password: {
      type: String,
      maxlength: 255,
    },
    role: {
      type: String,
      enum: ["admin", "seller_staff", "repository_staff", "customer"],
      default: "customer",
    },
    status: {
      type: String,
      enum: ["active", "blocked"],
      default: "active",
    },
    avatar_url: {
      type: String,
      maxlength: 500000, // Increased to 500KB for base64 images
    },
    qr_code_url: {
      type: String,
      maxlength: 500000,
    },
    loyalty_points: {
      type: Number,
      default: 0,
    },
    // Face recognition for check-in/checkout
    face_descriptor: {
      type: [Number], // Array to store face descriptor values
      default: undefined,
    },
    face_image_url: {
      type: String,
      maxlength: 500000, // Store face image for staff
    },
    address: {
      street: {
        type: String,
        maxlength: 500,
        default: "",
      },
      ward: {
        type: String,
        maxlength: 255,
        default: "",
      },
      district: {
        type: String,
        maxlength: 255,
        default: "",
      },
      city: {
        type: String,
        maxlength: 255,
        default: "",
      },
      _id: false, // Disable _id for subdocument
    },
    otp: {
      type: String,
    },
    otpExpiry: {
      type: Date,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    loginToken: {
      type: String,
    },
    loginTokenExpiry: {
      type: Date,
    },
    loginSessionId: {
      type: String,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  },
);

module.exports = mongoose.model("User", userSchema);

const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      auto: true,
    },
    order_code: {
      type: String,
      maxlength: 50,
      unique: true,
      required: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    staff_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    total_amount: {
      type: Number,
      default: 0,
    },
    discount_amount: {
      type: Number,
      default: 0,
    },
    tax_amount: {
      type: Number,
      default: 0,
    },
    final_amount: {
      type: Number,
      default: 0,
    },
    payment_method: {
      type: String,
      enum: ["cash", "card", "cod", "payos"],
    },
    payos_order_code: {
      type: Number,
      default: null,
    },
    payment_status: {
      type: String,
      enum: ["unpaid", "paid", "refunded"],
      default: "unpaid",
    },
    order_status: {
      type: String,
      enum: ["pending", "processing", "completed", "cancelled", "returned"],
      default: "pending",
    },
    order_type: {
      type: String,
      enum: ["online", "pos"],
    },
    is_on_hold: {
      type: Boolean,
      default: false,
    },
    coupon_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      default: null,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: true },
  },
);

module.exports = mongoose.model("Order", orderSchema);

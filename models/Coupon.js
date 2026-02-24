const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      auto: true,
    },
    code: {
      type: String,
      maxlength: 50,
      unique: true,
      required: true,
    },
    description: {
      type: String,
      maxlength: 255,
    },
    discount_type: {
      type: String,
      enum: ["percent", "fixed_amount"],
      required: true,
    },
    discount_value: {
      type: Number,
      default: 0,
    },
    min_order_value: {
      type: Number,
      default: 0,
    },
    max_discount_amount: {
      type: Number,
      default: 0,
    },
    start_date: {
      type: Date,
    },
    end_date: {
      type: Date,
    },
    quantity_limit: {
      type: Number,
    },
    points_required: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["active", "disabled"],
      default: "active",
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Coupon", couponSchema);

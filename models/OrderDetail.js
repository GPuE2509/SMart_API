const mongoose = require("mongoose");

const orderDetailSchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      auto: true,
    },
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    product_unit_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductUnit",
      required: true,
    },
    product_batch_id: {
      type: String, // ProductBatch._id is String
      ref: "ProductBatch",
    },
    batch_item_id: {
      type: mongoose.Schema.Types.ObjectId, // Item within batch items array
      default: null,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unit_price: {
      type: Number,
      default: 0,
    },
    total_price: {
      type: Number,
      default: 0,
    },
    // Rescue Pricing fields
    is_rescue_pricing: {
      type: Boolean,
      default: false,
    },
    original_unit_price: {
      type: Number,
      default: 0,
    },
    rescue_discount_percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    rescue_discount_amount: {
      type: Number,
      default: 0,
    },
    batch_allocations: {
      type: [
        {
          product_batch_id: {
            type: String,
            ref: "ProductBatch",
            required: true,
          },
          batch_item_id: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
          },
          quantity: {
            type: Number,
            required: true,
            min: 1,
          },
          original_unit_price: {
            type: Number,
            default: 0,
          },
          unit_price: {
            type: Number,
            required: true,
            min: 0,
          },
          discount_percentage: {
            type: Number,
            default: 0,
            min: 0,
            max: 100,
          },
          discount_amount: {
            type: Number,
            default: 0,
            min: 0,
          },
          is_rescue_pricing: {
            type: Boolean,
            default: false,
          },
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("OrderDetail", orderDetailSchema);

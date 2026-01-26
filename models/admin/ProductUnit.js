const mongoose = require("mongoose");

const productUnitSchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      auto: true,
    },
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    unit_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Unit",
      required: true,
    },
    exchange_value: {
      type: Number,
      default: 1,
    },
    price: {
      type: Number,
      default: 0,
    },
    barcode: {
      type: String,
      maxlength: 50,
      unique: true,
      sparse: true,
    },
    is_base_unit: {
      type: Boolean,
      default: false,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("ProductUnit", productUnitSchema);

const mongoose = require("mongoose");

const productBatchSchema = new mongoose.Schema(
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
    batch_code: {
      type: String,
      maxlength: 50,
    },
    import_price: {
      type: Number,
      default: 0,
    },
    quantity_initial: {
      type: Number,
      default: 0,
    },
    quantity_current: {
      type: Number,
      default: 0,
    },
    manufacture_date: {
      type: Date,
    },
    expiry_date: {
      type: Date,
    },
    supplier_name: {
      type: String,
      maxlength: 255,
    },
    status: {
      type: String,
      enum: ["instock", "outdate", "onsale", "sold", "rejected"],
      default: "instock",
    },
    is_deleted: {
      type: Boolean,
      default: false,
    },
    deleted_at: {
      type: Date,
      default: null,
    },
    deleted_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: true },
  },
);

module.exports = mongoose.model("ProductBatch", productBatchSchema);

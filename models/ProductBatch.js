const mongoose = require("mongoose");

const batchItemSchema = new mongoose.Schema(
  {
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
    quantity: {
      type: Number,
      required: true,
      default: 0,
    },
    import_price: {
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
  },
  { _id: false },
);

const productBatchSchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      auto: true,
    },
    batch_code: {
      type: String,
      required: true,
      unique: true,
      maxlength: 50,
    },
    items: {
      type: [batchItemSchema],
      required: true,
      validate: {
        validator: function (items) {
          return items && items.length > 0;
        },
        message: "Lô hàng phải có ít nhất 1 sản phẩm",
      },
    },
    date_status: {
      type: String,
      enum: ["active", "expired", "near_expiry"],
      default: "active",
    },
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

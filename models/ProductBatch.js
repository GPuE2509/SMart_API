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
    initial_quantity: {
      type: Number,
      required: true,
      default: 0,
    },
    current_quantity: {
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
  { _id: true },
);

const productBatchSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
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
    status: {
      type: String,
      enum: [
        "active",
        "expired",
        "near_expiry",
        "instock",
        "outdate",
        "onsale",
        "sold",
        "rejected",
      ],
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

// Virtual getter for batch_code (returns _id)
productBatchSchema.virtual("batch_code").get(function () {
  return this._id;
});

// Ensure virtuals are included in JSON
productBatchSchema.set("toJSON", { virtuals: true });
productBatchSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("ProductBatch", productBatchSchema);

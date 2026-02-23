const mongoose = require("mongoose");

const inventoryLogSchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      auto: true,
    },
    product_batch_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductBatch",
      required: true,
    },
    // product_id: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "Product",
    //   required: true,
    // },
    // unit_id: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "ProductUnit",
    //   required: true,
    // },
    quantity_change: {
      type: Number,
      required: true,
    },
    reason_type: {
      type: String,
      enum: [
        "sale",
        "import",
        "return",
        "damaged",
        "expired_disposal",
        "adjustment",
      ],
      required: true,
    },
    note: {
      type: String,
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false },
  },
);

module.exports = mongoose.model("InventoryLog", inventoryLogSchema);

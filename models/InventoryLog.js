const mongoose = require("mongoose");

const inventoryLogSchema = new mongoose.Schema(
  {
    product_batch_id: {
      type: String,
      ref: "ProductBatch",
      required: true,
    },
    batch_item_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
    },
    // product_id: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "Product",
    //   required: false,
    // },
    // unit_id: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "Unit",
    //   required: false,
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

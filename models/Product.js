const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      auto: true,
    },
    name: {
      type: String,
      maxlength: 255,
      required: true,
    },
    category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
    description: {
      type: String,
    },
    image_url: {
      type: String,
      maxlength: 1000, // Cloudinary URL
    },
    additional_images: {
      type: [String], // Array of image URLs for product gallery
      default: [],
      validate: {
        validator: function(images) {
          return images.length <= 10; // Maximum 10 additional images
        },
        message: 'Maximum 10 additional images allowed'
      }
    },
    tax_percentage: {
      type: Number,
      default: 8.0,
    },
    total_stock: {
      type: Number,
      default: 0,
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

module.exports = mongoose.model("Product", productSchema);

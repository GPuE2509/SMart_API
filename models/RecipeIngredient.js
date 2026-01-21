const mongoose = require('mongoose');

const recipeIngredientSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    auto: true
  },
  recipe_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Recipe',
    required: true
  },
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity_needed: {
    type: Number,
    default: 0
  },
  unit_note: {
    type: String,
    maxlength: 50
  }
}, {
  timestamps: true
});

// Composite index for recipe_id and product_id
recipeIngredientSchema.index({ recipe_id: 1, product_id: 1 }, { unique: true });

module.exports = mongoose.model('RecipeIngredient', recipeIngredientSchema);

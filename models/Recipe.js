const mongoose = require('mongoose');

const recipeSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    auto: true
  },
  title: {
    type: String,
    maxlength: 255,
    required: true
  },
  description: {
    type: String
  },
  instruction: {
    type: String
  },
  image_url: {
    type: String,
    maxlength: 500
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Recipe', recipeSchema);

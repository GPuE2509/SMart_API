const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    auto: true
  },
  name: {
    type: String,
    maxlength: 255,
    required: true
  },
  parent_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  description: {
    type: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Category', categorySchema);

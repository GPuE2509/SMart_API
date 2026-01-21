const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    auto: true
  },
  full_name: {
    type: String,
    maxlength: 255
  },
  email: {
    type: String,
    maxlength: 255,
    unique: true,
    sparse: true
  },
  phone: {
    type: String,
    maxlength: 20,
    unique: true,
    sparse: true
  },
  password: {
    type: String,
    maxlength: 255
  },
  role: {
    type: String,
    enum: ['admin', 'sellerStaff', 'repositoryStaff', 'customer'],
    default: 'customer'
  },
  status: {
    type: String,
    enum: ['active', 'blocked'],
    default: 'active'
  },
  avatar_url: {
    type: String,
    maxlength: 500
  },
  loyalty_points: {
    type: Number,
    default: 0
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('User', userSchema);
